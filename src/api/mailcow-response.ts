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
/** Mailcow stores booleans as "1" / "0". `intval(undefined)` is 0, so omitted `active` creates inactive rows. */
export function toMailcowFlag(value: boolean | number | string | undefined, defaultValue = true): '1' | '0' {
  if (value === undefined || value === null) {
    return defaultValue ? '1' : '0';
  }
  if (value === true || value === 1 || value === '1') {
    return '1';
  }
  if (value === false || value === 0 || value === '0') {
    return '0';
  }
  return defaultValue ? '1' : '0';
}

export function fromMailcowFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

export function actionMessageParts(item: MailcowActionItem | undefined): string[] {
  if (!item) {
    return [];
  }
  return Array.isArray(item.msg) ? item.msg.map(String) : item.msg ? [String(item.msg)] : [];
}

export function findActionMessage(
  data: unknown,
  code: string
): string[] | null {
  const items = extractMailcowActionItems(data) ?? [];
  for (const item of items) {
    const parts = actionMessageParts(item);
    if (parts[0] === code) {
      return parts;
    }
  }
  return null;
}

export function asObjectList<T>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }
  if (!response || typeof response !== 'object') {
    return [];
  }
  if (Object.keys(response as object).length === 0) {
    return [];
  }
  return [response as T];
}

/**
 * Mailcow `json_api.php` assigns a JSON delete body to `$_POST['items']` and
 * then `json_decode`s that whole value. A body of `["id"]` becomes the item
 * list. A body of `{ items: ["id"] }` becomes `{ items: ["id"] }` and is wrong.
 */
export function mailcowDeleteItems(items: Array<string | number>): string[] {
  return items.map(String);
}

/**
 * Mailcow `json_api.php` copies only `items` and `attr` from an edit JSON body.
 */
export function mailcowEditBody(
  items: Array<string | number>,
  attr: Record<string, unknown>
): { items: string[]; attr: Record<string, unknown> } {
  return { items: items.map(String), attr };
}

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
