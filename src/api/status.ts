import { APIClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  extractMailcowVersion,
  describeMailcowMismatch,
  mailcowReleaseMatches,
  TESTED_MAILCOW_RELEASE,
} from '../version';

export interface MailcowVersionStatus {
  reachable: boolean;
  version: string | null;
  raw: unknown;
  matches_tested: boolean | null;
  warning: string | null;
  error?: string;
}

export class StatusAPI {
  constructor(private client: APIClient) {}

  async getVersion(): Promise<MailcowVersionStatus> {
    try {
      const raw = await this.client.get<unknown>(API_ENDPOINTS.STATUS.VERSION);
      const version = extractMailcowVersion(raw);
      return {
        reachable: true,
        version,
        raw,
        matches_tested: mailcowReleaseMatches(version, TESTED_MAILCOW_RELEASE),
        warning: describeMailcowMismatch(version, TESTED_MAILCOW_RELEASE),
      };
    } catch (error) {
      return {
        reachable: false,
        version: null,
        raw: null,
        matches_tested: null,
        warning:
          'Could not read /api/v1/get/status/version. The endpoint exists from Mailcow 2022-05 and is admin-only; older releases or a non-admin API key return an empty body or an error.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
