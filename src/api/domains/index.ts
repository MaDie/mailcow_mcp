import { APIClient } from '../client';
import {
  MailcowDomain,
  ListDomainsParams,
  CreateDomainRequest,
  UpdateDomainRequest,
  APIAction,
} from '../../types';
import { buildDomainEndpoint } from '../endpoints';
import { mailcowDeleteItems, mailcowEditBody, toMailcowFlag } from '../mailcow-response';

function asDomainList(response: unknown): MailcowDomain[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object') {
    const domains =
      (response as { domains?: unknown; data?: unknown }).domains ||
      (response as { data?: unknown }).data ||
      response;
    return Array.isArray(domains) ? domains : [domains as MailcowDomain];
  }
  return [];
}

function matchesDomain(domain: MailcowDomain, domainId: string): boolean {
  return domain.domain_name === domainId || domain.domain === domainId;
}

function pickDomain(response: unknown, domainId: string): MailcowDomain | null {
  if (Array.isArray(response)) {
    return response.find((item) => matchesDomain(item, domainId)) || null;
  }
  if (response && typeof response === 'object') {
    const candidate = response as MailcowDomain;
    if (candidate.domain_name || candidate.domain) {
      return candidate;
    }
  }
  return null;
}

export class DomainAPI {
  constructor(private client: APIClient) {}

  async listDomains(_params?: ListDomainsParams): Promise<MailcowDomain[]> {
    const response = await this.client.get<MailcowDomain[]>(
      buildDomainEndpoint(APIAction.LIST)
    );
    return asDomainList(response);
  }

  async createDomain(domain: CreateDomainRequest): Promise<MailcowDomain> {
    await this.client.post(
      buildDomainEndpoint(APIAction.CREATE),
      domain
    );
    return this.getDomainDetails(domain.domain);
  }

  async updateDomain(domainId: string, updates: UpdateDomainRequest): Promise<MailcowDomain> {
    const attr: Record<string, unknown> = {};
    if (updates.description !== undefined) attr.description = updates.description;
    if (updates.active !== undefined) attr.active = toMailcowFlag(updates.active);
    if (updates.quota !== undefined) attr.quota = updates.quota;
    if (updates.maxquota !== undefined) attr.maxquota = updates.maxquota;
    if (updates.relayhost !== undefined) attr.relayhost = updates.relayhost;
    if (updates.relay_all_recipients !== undefined) {
      attr.relay_all_recipients = toMailcowFlag(updates.relay_all_recipients);
    }
    await this.client.post(
      buildDomainEndpoint(APIAction.UPDATE),
      mailcowEditBody([domainId], attr)
    );
    return this.getDomainDetails(domainId);
  }

  async deleteDomain(domainId: string): Promise<void> {
    await this.client.post<void>(
      buildDomainEndpoint(APIAction.DELETE),
      mailcowDeleteItems([domainId])
    );
  }

  async getDomainDetails(domainId: string): Promise<MailcowDomain> {
    const response = await this.client.get<MailcowDomain | MailcowDomain[]>(
      buildDomainEndpoint(APIAction.GET, domainId)
    );
    const domain = pickDomain(response, domainId);
    if (!domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }
    return domain;
  }
}
