/**
 * Mailcow write endpoints return HTTP 200 with an array of
 * `{ type, msg, log }` items. `type: danger` / `type: error` is a failed
 * operation even though the HTTP status is successful.
 */

export type MailcowActionType = 'success' | 'danger' | 'error' | 'warning';

export interface MailcowActionItem {
  type?: string;
  msg?: string | string[];
  log?: unknown;
}

const ACTION_TYPES = new Set(['success', 'danger', 'error', 'warning']);
const FAILURE_TYPES = new Set(['danger', 'error']);

export class MailcowAPIError extends Error {
  readonly items: MailcowActionItem[];

  constructor(message: string, items: MailcowActionItem[]) {
    super(message);
    this.name = 'MailcowAPIError';
    this.items = items;
  }
}

export function formatMailcowMessage(msg: string | string[] | undefined): string {
  if (Array.isArray(msg)) {
    return msg.filter(Boolean).join(': ');
  }
  return msg || 'Unknown error';
}

export function isMailcowActionItem(value: unknown): value is MailcowActionItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const type = String((value as MailcowActionItem).type ?? '').toLowerCase();
  return ACTION_TYPES.has(type);
}

export function extractMailcowActionItems(data: unknown): MailcowActionItem[] | null {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return null;
    }
    return data.every(isMailcowActionItem) ? data : null;
  }
  if (isMailcowActionItem(data)) {
    return [data];
  }
  return null;
}

export function isMailcowFailureType(type: string | undefined): boolean {
  return FAILURE_TYPES.has(String(type ?? '').toLowerCase());
}

/**
 * Throw when Mailcow reports type `danger` or `error`.
 * Non-action payloads (domain lists, mailbox objects, DKIM keys) are ignored.
 */
export function assertMailcowSuccess(data: unknown): void {
  const items = extractMailcowActionItems(data);
  if (!items) {
    return;
  }

  const failures = items.filter((item) => isMailcowFailureType(item.type));
  if (failures.length === 0) {
    return;
  }

  const message = failures.map((item) => formatMailcowMessage(item.msg)).join('; ');
  throw new MailcowAPIError(`Mailcow API error: ${message}`, failures);
}
