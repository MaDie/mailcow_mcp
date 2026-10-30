/**
 * Package versioning aligned to Mailcow releases.
 *
 * Scheme: YYYY.MM.PATCH
 * - YYYY.MM is the newest Mailcow release this build was source-verified against
 *   (Mailcow tags look like 2026-09; npm semver forbids a leading zero in the
 *   month, so 2026-09 becomes 2026.9.0, not 2026.09.0).
 * - PATCH increments for MCP-only changes that do not move the Mailcow target.
 *
 * Keep MCP_PACKAGE_VERSION in sync with package.json.
 */

export const MCP_PACKAGE_NAME = 'mailcow-mcp';
export const MCP_PACKAGE_VERSION = '2026.9.0';
export const TESTED_MAILCOW_RELEASE = '2026-09';
export const VERSIONING_SCHEME = 'YYYY.MM.PATCH';

export const MAILCOW_VERSION_ENDPOINT = '/api/v1/get/status/version';

export interface ParsedMailcowRelease {
  year: number;
  month: number;
  suffix: string;
  raw: string;
  canonical: string;
}

const RELEASE_RE = /^(\d{4})-(\d{1,2})([a-z])?$/i;
const SEMVER_MAILCOW_RE = /^(\d{4})\.(\d{1,2})(?:\.\d+)?$/;

export function parseMailcowRelease(value: unknown): ParsedMailcowRelease | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const tagged = trimmed.match(RELEASE_RE);
  if (tagged) {
    const year = Number(tagged[1]);
    const month = Number(tagged[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return null;
    }
    const suffix = (tagged[3] || '').toLowerCase();
    const canonical = `${year}-${String(month).padStart(2, '0')}`;
    return { year, month, suffix, raw: trimmed, canonical };
  }

  const semver = trimmed.match(SEMVER_MAILCOW_RE);
  if (semver) {
    const year = Number(semver[1]);
    const month = Number(semver[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return null;
    }
    const canonical = `${year}-${String(month).padStart(2, '0')}`;
    return { year, month, suffix: '', raw: trimmed, canonical };
  }

  return null;
}

export function extractMailcowVersion(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as Record<string, unknown>;
  for (const key of ['version', 'git_version', 'MAILCOW_GIT_VERSION']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function mailcowReleaseMatches(
  connected: string | null | undefined,
  tested: string = TESTED_MAILCOW_RELEASE
): boolean | null {
  const left = parseMailcowRelease(connected);
  const right = parseMailcowRelease(tested);
  if (!left || !right) {
    return null;
  }
  return left.year === right.year && left.month === right.month;
}

export function describeMailcowMismatch(
  connected: string | null | undefined,
  tested: string = TESTED_MAILCOW_RELEASE
): string | null {
  const matches = mailcowReleaseMatches(connected, tested);
  if (matches === null) {
    if (!connected) {
      return null;
    }
    return `Connected Mailcow version '${connected}' could not be compared with tested release ${tested}.`;
  }
  if (matches) {
    return null;
  }
  return `Connected Mailcow ${connected} does not match the Mailcow release this MCP server was source-verified against (${tested}). Some tools may misbehave.`;
}

export function mcpVersionInfo() {
  return {
    name: MCP_PACKAGE_NAME,
    version: MCP_PACKAGE_VERSION,
    versioning_scheme: VERSIONING_SCHEME,
    tested_mailcow: TESTED_MAILCOW_RELEASE,
  };
}
