# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow `YYYY.MM.PATCH` (see [README](README.md#versioning)):
`YYYY.MM` is the newest [mailcow-dockerized](https://github.com/mailcow/mailcow-dockerized) release this build was source-verified against. npm semver forbids a leading zero in the month, so Mailcow `2026-09` is published as `2026.9.0`, not `2026.09.0`.

## [2026.10.0] - 2026-10-30

### Changed

- Compatibility target moved from Mailcow **2026-09** to **2026-10**. Package version `2026.9.3` → `2026.10.0`.
- [COMPATIBILITY.md](COMPATIBILITY.md) re-diffed `mailcow-dockerized` `2026-09` → `2026-10` for every route/field registered tools use (`json_api.php`, OpenAPI, `functions.mailbox.inc.php`, `functions.dkim.inc.php`, `functions.mailq.inc.php`). Used routes and fields are unchanged. The only `json_api.php` addition is unused `edit` / `ui_theme`.
- Live read checks on production `2026-10` recorded: `get_mailcow_version`, `list_domains`, `list_queue_items`, `list_aliases`, `list_dkim_keys`.

### Fixed

- **DKIM list/get display:** Mailcow `GET /api/v1/get/dkim/{domain}` returns `length` (string bits), `dkim_selector`, `pubkey`, `dkim_txt` — not `key_size`, `id`, `created`, or `modified`. `length` is now mapped to `key_size`; dates and `key_id` are omitted when Mailcow does not send them (no more `0` / `1970-01-01`).

### Compatibility notes

No used Mailcow API route or write field changed between `2026-09` and `2026-10`. Sync-job create/edit field names and queue flush body remain mismatched. Details: [COMPATIBILITY.md](COMPATIBILITY.md).

## [2026.9.3] - 2026-10-30

### Changed

- **README** rewritten to match the registered tools: 47 tools including aliases, sieve filters, DKIM (no update), and `get_mailcow_version`. Removed user tools and `update_dkim_key` are documented. Start command is `node dist/index.js`. Env vars, versioning, [COMPATIBILITY.md](COMPATIBILITY.md), and MIT / [leolilley/mailcow_mcp](https://github.com/leolilley/mailcow_mcp) attribution are explicit. Stale “20 tools”, coverage claims, and placeholder GitHub URLs are gone.
- **Dependencies** updated to current releases used by this tree (MCP SDK 1.32, Zod 4, axios 1.21, dotenv 18, ESLint 10, Jest 30, TypeScript 5.9). Node engine is `>=20`. Dependabot weekly config added. See the 2026.9.3 PR for the before/after table.

### Compatibility notes

No Mailcow path or payload changes versus 2026.9.2. [COMPATIBILITY.md](COMPATIBILITY.md) still applies.

## [2026.9.2] - 2026-10-30

### Removed

- **User tools** (`list_users`, `get_user`, `create_user`, `update_user`, `delete_user`). Mailcow has no `/user` API category (`json_api.php` has no `case "user"`). Mailcow users *are* mailboxes — use the mailbox tools.
- **`update_dkim_key`**. `/edit/dkim` does not exist on any compared Mailcow tag. Rotate a key with `delete_dkim_key` then `create_dkim_key`.

### Fixed

- Sync-job **list/get** now call `GET /api/v1/get/syncjobs/all/no_log`. The per-mailbox variant is `GET /api/v1/get/syncjobs/{mailbox}/no_log` (source `object` default).
- Queue **list/get** now call `GET /api/v1/get/mailq/all` (`json_api.php` only handles `object === "all"`).
- Queue **release** sends `{ items: [qid], attr: { action: "unhold" } }` as `json_api.php` edit unwrap + `functions.mailq.inc.php` require. The tool stays `release_queue_item` and requires `confirm`. Hold uses the same `{ items, attr }` shape with `action: "hold"`.
- DKIM **create** sends `{ domains, dkim_selector, key_size }` (`functions.dkim.inc.php` / OpenAPI).

All of the above are **source-verified** against Mailcow `2026-09` `json_api.php` / OpenAPI, **not live-verified**. Written from Mailcow source, not from third-party forks.

### Compatibility notes

Sync-job create/edit field names and queue flush body remain mismatched. Details: [COMPATIBILITY.md](COMPATIBILITY.md).

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
