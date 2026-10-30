/**
 * Sieve filter API
 * Mailcow endpoints: /api/v1/get/filters/{mailbox|all}, /add/filter, /edit/filter, /delete/filter
 */

import { APIClient } from '../client';
import {
  MailcowSieveFilter,
  CreateSieveFilterRequest,
  UpdateSieveFilterRequest,
  ListSieveFilterParams,
  APIAction,
} from '../../types';
import { buildFilterEndpoint } from '../endpoints';
import {
  asObjectList,
  fromMailcowFlag,
  MailcowAPIError,
  mailcowDeleteItems,
  mailcowEditBody,
  toMailcowFlag,
} from '../mailcow-response';

interface RawFilter {
  id?: number | string;
  username?: string;
  script_desc?: string;
  script_data?: string;
  filter_type?: string;
  active?: boolean | number | string;
}

export function normalizeSieveFilter(raw: RawFilter): MailcowSieveFilter | null {
  if (!raw || (raw.id === undefined && !raw.script_desc && !raw.script_data)) {
    return null;
  }
  const filterType = raw.filter_type === 'postfilter' ? 'postfilter' : 'prefilter';
  return {
    id: Number(raw.id ?? 0),
    username: raw.username || '',
    script_desc: raw.script_desc || '',
    script_data: raw.script_data || '',
    filter_type: filterType,
    active: fromMailcowFlag(raw.active),
  };
}

export class FilterAPI {
  constructor(private client: APIClient) {}

  async listFilters(params?: ListSieveFilterParams): Promise<MailcowSieveFilter[]> {
    const url = params?.username
      ? buildFilterEndpoint(APIAction.GET, params.username)
      : buildFilterEndpoint(APIAction.LIST);
    const response = await this.client.get<unknown>(url);
    return asObjectList<RawFilter>(response)
      .map(normalizeSieveFilter)
      .filter((item): item is MailcowSieveFilter => item !== null);
  }

  async createFilter(request: CreateSieveFilterRequest): Promise<MailcowSieveFilter> {
    const payload = {
      username: request.username,
      script_desc: request.script_desc,
      script_data: request.script_data,
      filter_type: request.filter_type ?? 'prefilter',
      active: toMailcowFlag(request.active, true),
    };

    await this.client.post(buildFilterEndpoint(APIAction.CREATE), payload);

    const created = (await this.listFilters({ username: request.username })).find(
      (filter) =>
        filter.script_desc === request.script_desc &&
        filter.filter_type === payload.filter_type
    );
    if (!created) {
      throw new MailcowAPIError(
        `Sieve filter '${request.script_desc}' for '${request.username}' was not found after create`,
        []
      );
    }
    return created;
  }

  async updateFilter(
    filterId: string,
    updates: UpdateSieveFilterRequest
  ): Promise<MailcowSieveFilter> {
    const existing = await this.getFilter(filterId);
    const attr = {
      script_desc: updates.script_desc ?? existing.script_desc,
      script_data: updates.script_data ?? existing.script_data,
      filter_type: updates.filter_type ?? existing.filter_type,
      active: toMailcowFlag(
        updates.active !== undefined ? updates.active : existing.active
      ),
    };

    await this.client.post(
      buildFilterEndpoint(APIAction.UPDATE),
      mailcowEditBody([filterId], attr)
    );
    return this.getFilter(filterId);
  }

  async deleteFilter(filterId: string): Promise<void> {
    await this.client.post<void>(
      buildFilterEndpoint(APIAction.DELETE),
      mailcowDeleteItems([filterId])
    );
  }

  async getFilter(filterId: string): Promise<MailcowSieveFilter> {
    const filters = await this.listFilters();
    const match = filters.find((filter) => String(filter.id) === String(filterId));
    if (!match) {
      throw new Error(`Sieve filter not found: ${filterId}`);
    }
    return match;
  }
}
