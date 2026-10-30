# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow `YYYY.MM.PATCH` (see [README](README.md#versioning)):
`YYYY.MM` is the newest [mailcow-dockerized](https://github.com/mailcow/mailcow-dockerized) release this build was source-verified against. npm semver forbids a leading zero in the month, so Mailcow `2026-09` is published as `2026.9.0`, not `2026.09.0`.

## [2026.9.0] - 2026-10-30

First version that uses the Mailcow-aligned scheme. Compatibility target: Mailcow **2026-09** (production). Source of Mailcow `2026-10` was also compared; used API routes were unchanged.

### Added

- `COMPATIBILITY.md` — endpoint-by-endpoint audit against mailcow-dockerized tags (no live instance).
- `get_mailcow_version` tool — reports the MCP package version, the tested Mailcow release, and (admin API key) `GET /api/v1/get/status/version`, with a mismatch warning.
- MCP server info, `health_check`, and `get_config` now expose `2026.9.0` and `tested_mailcow: 2026-09`.
- Optional GitHub Actions workflow that tags `v<package.json version>` from `workflow_dispatch`.

### Changed

- Package version `0.1.0` → `2026.9.0`.

### Compatibility notes

No Mailcow release is fully supported. User tools, sync-job GET, queue GET, DKIM edit, and several write payloads do not match Mailcow on any compared tag. Details: [COMPATIBILITY.md](COMPATIBILITY.md).
