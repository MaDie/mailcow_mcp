/**
 * DKIM API
 * Handles DKIM key management operations for Mailcow
 */

import { APIClient } from '../client';
import {
  MailcowDKIM,
  CreateDKIMRequest,
  ListDKIMParams,
  MailcowAPIResponse,
  MailcowDomain,
} from '../../types';
import { buildDKIMEndpoint, buildDomainEndpoint } from '../endpoints';
import { APIAction } from '../../types/api';
import { mailcowDeleteItems } from '../mailcow-response';

interface RawDKIM {
  id?: number | string;
  domain?: string;
  selector?: string;
  dkim_selector?: string;
  key_size?: number | string;
  key_length?: number | string;
  /** Mailcow `dkim('details')` / OpenAPI: bits as a string, e.g. "2048" or ">= 8192" */
  length?: number | string;
  algorithm?: 'rsa' | 'ed25519' | string;
  public_key?: string;
  pubkey?: string;
  dkim_txt?: string;
  active?: boolean | number;
  created?: Date | string;
  modified?: Date | string;
}

function parseAlgorithm(record: string | undefined): 'rsa' | 'ed25519' | undefined {
  if (!record) {
    return undefined;
  }
  const match = record.match(/(?:^|[;\s])k=([a-z0-9]+)/i);
  if (!match) {
    return undefined;
  }
  return match[1].toLowerCase() === 'ed25519' ? 'ed25519' : 'rsa';
}

function extractPublicKey(record: string | undefined): string | undefined {
  if (!record) {
    return undefined;
  }
  const match = record.match(/(?:^|[;\s])p=([A-Za-z0-9+/=]+)/);
  return match?.[1];
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const match = value.match(/(\d+)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return undefined;
}

/** Mailcow GET /dkim returns `length`, not `key_size` / `key_length`. */
function parseKeySize(raw: RawDKIM): number | undefined {
  return parsePositiveInt(raw.key_size) ?? parsePositiveInt(raw.key_length) ?? parsePositiveInt(raw.length);
}

function toOptionalDate(value: Date | string | undefined): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) || value.getTime() === 0 ? undefined : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() !== 0) {
      return parsed;
    }
  }
  return undefined;
}

export function normalizeDKIMKey(
  domain: string,
  resp: unknown,
  selectorHint?: string
): MailcowDKIM | null {
  if (!resp || typeof resp !== 'object') {
    return null;
  }

  if (Array.isArray(resp)) {
    for (const item of resp) {
      const normalized = normalizeDKIMKey(domain, item, selectorHint);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  const raw = resp as RawDKIM;
  const dkimTxt = raw.dkim_txt ?? raw.pubkey ?? raw.public_key;
  const selector = raw.dkim_selector ?? raw.selector ?? selectorHint;
  if (!dkimTxt && !raw.public_key && !raw.pubkey) {
    return null;
  }

  const publicKey =
    extractPublicKey(typeof dkimTxt === 'string' ? dkimTxt : undefined) ??
    raw.public_key ??
    raw.pubkey ??
    '';
  const algorithm =
    (raw.algorithm === 'ed25519' || raw.algorithm === 'rsa'
      ? raw.algorithm
      : parseAlgorithm(typeof dkimTxt === 'string' ? dkimTxt : undefined)) ?? 'rsa';
  const keySize = parseKeySize(raw);
  const hasMaterial = Boolean(dkimTxt || publicKey);
  const id = parsePositiveInt(raw.id);
  const created = toOptionalDate(raw.created);
  const modified = toOptionalDate(raw.modified);

  return {
    ...(id !== undefined ? { id } : {}),
    domain: raw.domain ?? domain,
    selector: selector || 'dkim',
    ...(keySize !== undefined ? { key_size: keySize } : {}),
    algorithm,
    public_key: publicKey,
    dkim_txt: typeof dkimTxt === 'string' ? dkimTxt : undefined,
    active: raw.active !== undefined ? Boolean(raw.active) : hasMaterial,
    ...(created ? { created } : {}),
    ...(modified ? { modified } : {}),
  };
}

function domainNames(response: unknown): string[] {
  const items = Array.isArray(response)
    ? response
    : response
      ? [response]
      : [];
  return items
    .map((item) => {
      const domain = item as MailcowDomain;
      return domain.domain_name || domain.domain || '';
    })
    .filter((name): name is string => Boolean(name));
}

/**
 * DKIM API class for managing Mailcow DKIM keys
 */
export class DKIMAPI {
  constructor(private client: APIClient) {}

  /**
   * List DKIM keys by querying /get/dkim/<domain> for each domain.
   * Mailcow has no list endpoint that returns an array of keys.
   */
  async listDKIMKeys(params?: ListDKIMParams): Promise<MailcowDKIM[]> {
    const domains = params?.domain
      ? [params.domain]
      : domainNames(
          await this.client.get<MailcowDomain[]>(buildDomainEndpoint(APIAction.LIST))
        );

    const keys = (
      await Promise.all(
        domains.map(async (domain) => {
          try {
            return await this.fetchDKIMForDomain(domain, params?.selector);
          } catch {
            return null;
          }
        })
      )
    ).filter((key): key is MailcowDKIM => key !== null);

    return keys.filter((key) => {
      if (params?.active !== undefined && key.active !== params.active) {
        return false;
      }
      if (params?.selector && key.selector !== params.selector) {
        return false;
      }
      if (params?.algorithm && key.algorithm !== params.algorithm) {
        return false;
      }
      if (params?.created_after && (!key.created || key.created < params.created_after)) {
        return false;
      }
      if (params?.created_before && (!key.created || key.created > params.created_before)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get a specific DKIM key by domain and selector
   */
  async getDKIMKey(
    domain: string,
    selector: string
  ): Promise<MailcowDKIM | null> {
    const key = await this.fetchDKIMForDomain(domain, selector);
    if (!key) {
      return null;
    }
    if (selector && key.selector !== selector) {
      return null;
    }
    return key;
  }

  /**
   * Get DKIM keys by domain
   */
  async getDKIMKeysByDomain(domain: string): Promise<MailcowDKIM[]> {
    return this.listDKIMKeys({ domain });
  }

  /**
   * Create a new DKIM key
   */
  async createDKIMKey(dkimData: CreateDKIMRequest): Promise<MailcowDKIM> {
    await this.client.post(
      buildDKIMEndpoint(APIAction.CREATE),
      {
        domains: dkimData.domain,
        dkim_selector: dkimData.selector,
        key_size: dkimData.key_size ?? 2048,
      }
    );
    const created = await this.getDKIMKey(dkimData.domain, dkimData.selector);
    if (created) {
      return created;
    }
    return {
      domain: dkimData.domain,
      selector: dkimData.selector,
      key_size: dkimData.key_size ?? 2048,
      algorithm: dkimData.algorithm ?? 'rsa',
      public_key: '',
      active: true,
    };
  }

  /**
   * Delete a DKIM key
   */
  async deleteDKIMKey(domain: string, _selector: string): Promise<boolean> {
    const response = await this.client.post<MailcowAPIResponse | unknown>(
      buildDKIMEndpoint(APIAction.DELETE),
      mailcowDeleteItems([domain])
    );
    if (response && typeof response === 'object' && 'success' in (response as MailcowAPIResponse)) {
      return Boolean((response as MailcowAPIResponse).success);
    }
    return true;
  }

  /**
   * Get active DKIM keys
   */
  async getActiveDKIMKeys(): Promise<MailcowDKIM[]> {
    return this.listDKIMKeys({ active: true });
  }

  /**
   * Get inactive DKIM keys
   */
  async getInactiveDKIMKeys(): Promise<MailcowDKIM[]> {
    return this.listDKIMKeys({ active: false });
  }

  /**
   * Get DKIM keys by algorithm
   */
  async getDKIMKeysByAlgorithm(
    algorithm: 'rsa' | 'ed25519'
  ): Promise<MailcowDKIM[]> {
    return this.listDKIMKeys({ algorithm });
  }

  /**
   * Get DKIM keys created after a specific date
   */
  async getDKIMKeysCreatedAfter(date: Date): Promise<MailcowDKIM[]> {
    return this.listDKIMKeys({ created_after: date });
  }

  /**
   * Get DKIM keys created before a specific date
   */
  async getDKIMKeysCreatedBefore(date: Date): Promise<MailcowDKIM[]> {
    return this.listDKIMKeys({ created_before: date });
  }

  /**
   * DNS record value for a key. Mailcow already returns a complete
   * `v=DKIM1;k=...;p=...` string as `dkim_txt` — do not wrap it again.
   */
  generateDKIMDNSRecord(dkim: MailcowDKIM): string {
    if (dkim.dkim_txt && /v=DKIM1/i.test(dkim.dkim_txt)) {
      return dkim.dkim_txt;
    }
    if (dkim.public_key && /v=DKIM1/i.test(dkim.public_key)) {
      return dkim.public_key;
    }
    const algorithm = dkim.algorithm || 'rsa';
    const publicKey = dkim.public_key || '';
    return `v=DKIM1; k=${algorithm}; p=${publicKey}`;
  }

  /**
   * Validate DKIM key configuration
   */
  validateDKIMKey(dkim: MailcowDKIM): boolean {
    const hasMaterial = Boolean(
      (dkim.dkim_txt && /(?:^|[;\s])p=/.test(dkim.dkim_txt)) ||
        (dkim.public_key && dkim.public_key.length > 0)
    );
    return Boolean(dkim.domain) && Boolean(dkim.selector) && hasMaterial;
  }

  private async fetchDKIMForDomain(
    domain: string,
    selector?: string
  ): Promise<MailcowDKIM | null> {
    const resp = await this.client.get<unknown>(
      buildDKIMEndpoint(APIAction.GET, domain)
    );
    return normalizeDKIMKey(domain, resp, selector);
  }
}
