# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow `YYYY.MM.PATCH` (see [README](README.md#versioning)):
`YYYY.MM` is the newest [mailcow-dockerized](https://github.com/mailcow/mailcow-dockerized) release this build was source-verified against. npm semver forbids a leading zero in the month, so Mailcow `2026-09` is published as `2026.9.0`, not `2026.09.0`.

## [2026.9.1] - 2026-10-30

### Fixed

- Mailcow **delete** bodies are now a plain JSON array of ids (`["user@domain"]`, `["example.com"]`, …). `json_api.php` assigns the whole request body to `$_POST['items']`; wrapping `{ items: [...] }` or `{ mailbox }` / `{ domain }` was wrong. Applied to mailbox, alias, domain, sieve filter, DKIM (domain list), sync job, and mail queue.
- Mailcow **edit** bodies for domain and mailbox are now `{ items: [...], attr: { ... } }`, matching alias/filter and the PHP JSON unwrap. Booleans go out as `"1"`/`"0"`; mailbox password edits still send `password2`.

Mailbox/alias delete and alias edit were independently live-confirmed by a third-party fork of this project. That fork has no license; this change was written from Mailcow `json_api.php` / OpenAPI, not copied from their tree.

### Compatibility notes

User tools, sync-job GET/create/edit field names, queue GET, queue hold/release action names, DKIM create field names, and `/edit/dkim` remain mismatched. Details: [COMPATIBILITY.md](COMPATIBILITY.md).

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
