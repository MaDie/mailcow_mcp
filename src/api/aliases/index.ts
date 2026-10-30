import { APIClient } from '../client';
import {
  MailcowAlias,
  ListAliasesParams,
  CreateAliasRequest,
  UpdateAliasRequest,
  APIAction,
} from '../../types';
import { buildAliasEndpoint } from '../endpoints';
import {
  asObjectList,
  findActionMessage,
  fromMailcowFlag,
  MailcowAPIError,
  mailcowDeleteItems,
  mailcowEditBody,
  toMailcowFlag,
} from '../mailcow-response';

interface RawAlias {
  id?: number | string;
  address?: string;
  goto?: string;
  domain?: string;
  active?: boolean | number | string;
  sogo_visible?: boolean | number | string;
  public_comment?: string | null;
  private_comment?: string | null;
  created?: string;
  modified?: string | null;
}

export function normalizeAlias(raw: RawAlias | MailcowAlias): MailcowAlias {
  return {
    id: Number(raw.id ?? 0),
    address: raw.address || '',
    goto: raw.goto || '',
    domain: raw.domain || '',
    active: fromMailcowFlag(raw.active),
    sogo_visible: raw.sogo_visible !== undefined ? fromMailcowFlag(raw.sogo_visible) : undefined,
    public_comment: raw.public_comment ?? undefined,
    private_comment: raw.private_comment ?? undefined,
    created: raw.created ?? new Date(0),
    modified: raw.modified ?? null,
  };
}

export class AliasAPI {
  constructor(private client: APIClient) {}

  async listAliases(params?: ListAliasesParams): Promise<MailcowAlias[]> {
    const response = await this.client.get<unknown>(buildAliasEndpoint(APIAction.LIST));
    let aliases = asObjectList<RawAlias>(response).map(normalizeAlias);

    if (params?.domain) {
      aliases = aliases.filter((alias) => alias.domain === params.domain);
    }
    if (params?.active !== undefined) {
      aliases = aliases.filter((alias) => alias.active === params.active);
    }
    if (params?.address) {
      const needle = params.address.toLowerCase();
      aliases = aliases.filter((alias) => alias.address.toLowerCase().includes(needle));
    }
    if (params?.goto) {
      aliases = aliases.filter((alias) => alias.goto.includes(params.goto as string));
    }
    return aliases;
  }

  async createAlias(alias: CreateAliasRequest): Promise<MailcowAlias> {
    const payload = {
      address: alias.address,
      goto: alias.goto,
      active: toMailcowFlag(alias.active, true),
      sogo_visible: toMailcowFlag(alias.sogo_visible, true),
      ...(alias.public_comment ? { public_comment: alias.public_comment } : {}),
      ...(alias.private_comment ? { private_comment: alias.private_comment } : {}),
      ...(alias.goto_null ? { goto_null: '1' } : {}),
      ...(alias.goto_spam ? { goto_spam: '1' } : {}),
      ...(alias.goto_ham ? { goto_ham: '1' } : {}),
    };

    const response = await this.client.post<unknown>(
      buildAliasEndpoint(APIAction.CREATE),
      payload
    );

    const added = findActionMessage(response, 'alias_added');
    if (!added) {
      throw new MailcowAPIError(
        `Mailcow did not create alias '${alias.address}'. The response had no alias_added message.`,
        []
      );
    }

    const createdAddress = added[1] || alias.address;
    const createdId = added[2];
    if (createdId !== undefined && createdId !== '') {
      return this.getAliasDetails(String(createdId));
    }
    return this.getAliasByAddress(createdAddress);
  }

  async updateAlias(
    aliasId: string,
    updates: UpdateAliasRequest
  ): Promise<MailcowAlias> {
    const attr: Record<string, string> = {};
    if (updates.address !== undefined) attr.address = updates.address;
    if (updates.goto !== undefined) attr.goto = updates.goto;
    if (updates.active !== undefined) attr.active = toMailcowFlag(updates.active);
    if (updates.sogo_visible !== undefined) attr.sogo_visible = toMailcowFlag(updates.sogo_visible);
    if (updates.public_comment !== undefined) attr.public_comment = updates.public_comment;
    if (updates.private_comment !== undefined) attr.private_comment = updates.private_comment;

    await this.client.post(buildAliasEndpoint(APIAction.UPDATE), mailcowEditBody([aliasId], attr));
    return this.getAliasDetails(aliasId);
  }

  async deleteAlias(aliasId: string): Promise<void> {
    await this.client.post<void>(
      buildAliasEndpoint(APIAction.DELETE),
      mailcowDeleteItems([aliasId])
    );
  }

  async getAliasDetails(aliasId: string): Promise<MailcowAlias> {
    if (/^\d+$/.test(aliasId)) {
      const response = await this.client.get<unknown>(
        buildAliasEndpoint(APIAction.GET, aliasId)
      );
      const match = asObjectList<RawAlias>(response)
        .map(normalizeAlias)
        .find((alias) => String(alias.id) === aliasId);
      if (match) {
        return match;
      }
    }
    return this.getAliasByAddress(aliasId);
  }

  async getAliasByAddress(address: string): Promise<MailcowAlias> {
    const aliases = await this.listAliases();
    const alias = aliases.find((item) => item.address === address);
    if (!alias) {
      throw new Error(`Alias not found: ${address}`);
    }
    return alias;
  }

  async getUserAliases(username: string): Promise<MailcowAlias[]> {
    const aliases = await this.listAliases();
    return aliases.filter((alias) => alias.goto.includes(username));
  }
}
