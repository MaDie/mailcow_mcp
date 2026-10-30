import {
  MCP_PACKAGE_VERSION,
  TESTED_MAILCOW_RELEASE,
  describeMailcowMismatch,
  extractMailcowVersion,
  mailcowReleaseMatches,
  mcpVersionInfo,
  parseMailcowRelease,
} from '../../src/version';

const packageJsonVersion: string = require('../../package.json').version;

describe('Mailcow-aligned versioning', () => {
  it('keeps package.json in sync with the version module', () => {
    expect(MCP_PACKAGE_VERSION).toBe(packageJsonVersion);
    expect(MCP_PACKAGE_VERSION).toBe('2026.9.1');
    expect(TESTED_MAILCOW_RELEASE).toBe('2026-09');
  });

  it('exposes scheme metadata for server info', () => {
    expect(mcpVersionInfo()).toEqual({
      name: 'mailcow-mcp',
      version: '2026.9.1',
      versioning_scheme: 'YYYY.MM.PATCH',
      tested_mailcow: '2026-09',
    });
  });

  it('parses Mailcow tags and unpadded npm months', () => {
    expect(parseMailcowRelease('2026-09')).toEqual({
      year: 2026,
      month: 9,
      suffix: '',
      raw: '2026-09',
      canonical: '2026-09',
    });
    expect(parseMailcowRelease('2026-09a')?.canonical).toBe('2026-09');
    expect(parseMailcowRelease('2026.9.0')?.canonical).toBe('2026-09');
    expect(parseMailcowRelease('not-a-version')).toBeNull();
  });

  it('reads version from the status payload', () => {
    expect(extractMailcowVersion({ version: '2026-09' })).toBe('2026-09');
    expect(extractMailcowVersion({})).toBeNull();
    expect(extractMailcowVersion('2022-04')).toBe('2022-04');
  });

  it('warns only when the monthly release differs', () => {
    expect(mailcowReleaseMatches('2026-09', '2026-09')).toBe(true);
    expect(mailcowReleaseMatches('2026-09a', '2026-09')).toBe(true);
    expect(mailcowReleaseMatches('2026-10', '2026-09')).toBe(false);
    expect(describeMailcowMismatch('2026-09')).toBeNull();
    expect(describeMailcowMismatch('2025-03')).toMatch(/does not match/);
    expect(describeMailcowMismatch(null)).toBeNull();
  });
});
