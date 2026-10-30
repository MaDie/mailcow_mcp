import { APIClient } from '../client';
import {
  MailcowMailbox,
  ListMailboxesParams,
  CreateMailboxRequest,
  UpdateMailboxRequest,
  APIAction,
} from '../../types';
import { buildMailboxEndpoint } from '../endpoints';
import { mailcowDeleteItems, mailcowEditBody, toMailcowFlag } from '../mailcow-response';

function asMailboxList(response: unknown): MailcowMailbox[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object') {
    const mailboxes =
      (response as { mailboxes?: unknown; data?: unknown }).mailboxes ||
      (response as { data?: unknown }).data ||
      response;
    return Array.isArray(mailboxes) ? mailboxes : [mailboxes as MailcowMailbox];
  }
  return [];
}

function matchesMailbox(mailbox: MailcowMailbox, mailboxId: string): boolean {
  return mailbox.username === mailboxId;
}

function pickMailbox(response: unknown, mailboxId: string): MailcowMailbox | null {
  if (Array.isArray(response)) {
    return response.find((item) => matchesMailbox(item, mailboxId)) || null;
  }
  if (response && typeof response === 'object') {
    const candidate = response as MailcowMailbox;
    if (candidate.username) {
      return candidate;
    }
  }
  return null;
}

export class MailboxAPI {
  constructor(private client: APIClient) {}

  async listMailboxes(_params?: ListMailboxesParams): Promise<MailcowMailbox[]> {
    const response = await this.client.get<MailcowMailbox[]>(
      buildMailboxEndpoint(APIAction.LIST)
    );
    return asMailboxList(response);
  }

  async createMailbox(mailbox: CreateMailboxRequest): Promise<MailcowMailbox> {
    await this.client.post(
      buildMailboxEndpoint(APIAction.CREATE),
      { ...mailbox, password2: mailbox.password2 ?? mailbox.password }
    );
    return this.getMailboxDetails(`${mailbox.local_part}@${mailbox.domain}`);
  }

  async updateMailbox(mailboxId: string, updates: UpdateMailboxRequest): Promise<MailcowMailbox> {
    const attr: Record<string, unknown> = {};
    if (updates.quota !== undefined) attr.quota = updates.quota;
    if (updates.name !== undefined) attr.name = updates.name;
    if (updates.active !== undefined) attr.active = toMailcowFlag(updates.active);
    if (updates.password !== undefined) {
      attr.password = updates.password;
      attr.password2 = updates.password;
    }
    await this.client.post(
      buildMailboxEndpoint(APIAction.UPDATE),
      mailcowEditBody([mailboxId], attr)
    );
    return this.getMailboxDetails(mailboxId);
  }

  async deleteMailbox(mailboxId: string): Promise<void> {
    await this.client.post<void>(
      buildMailboxEndpoint(APIAction.DELETE),
      mailcowDeleteItems([mailboxId])
    );
  }

  async getMailboxDetails(mailboxId: string): Promise<MailcowMailbox> {
    const response = await this.client.get<MailcowMailbox | MailcowMailbox[]>(
      buildMailboxEndpoint(APIAction.GET, mailboxId)
    );
    const mailbox = pickMailbox(response, mailboxId);
    if (!mailbox) {
      throw new Error(`Mailbox not found: ${mailboxId}`);
    }
    return mailbox;
  }

  async setMailboxQuota(mailboxId: string, quota: number): Promise<MailcowMailbox> {
    return this.updateMailbox(mailboxId, { quota });
  }
}
