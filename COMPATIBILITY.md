# Mailcow compatibility

This document records which [mailcow-dockerized](https://github.com/mailcow/mailcow-dockerized) releases this MCP server can talk to.

**Do not treat this as a live test report.** No Mailcow instance (including the production host on `2026-09`) was called from this environment. Every claim below comes from comparing the paths and payloads this repo actually sends with Mailcow source and OpenAPI at published git tags. Anything not compared that way is marked **unverified**.

## Summary

| Item | Result |
|------|--------|
| Newest Mailcow release this build is versioned against | **2026-09** (npm package `2026.9.1`) |
| Newest Mailcow tag whose API source was compared | **2026-10** (used routes unchanged vs 2026-09 except an unrelated `ui_theme` add) |
| Oldest Mailcow tag whose `json_api.php` was compared | **2022-01** |
| Minimum source-verified Mailcow for the working read/create subset | **2022-01** |
| Minimum Mailcow for `get_mailcow_version` (`GET /api/v1/get/status/version`) | **2022-05** (PR [mailcow#4557](https://github.com/mailcow/mailcow-dockerized/pull/4557), merged 2022-05-04; absent on tag `2022-04`) |
| Fully supported Mailcow release | **None** — several registered tools call routes or field names that Mailcow has never exposed |
| Releases before `2022-01` | **Unverified** (tags were not downloaded) |
| Live behaviour on production `2026-09` | **Unverified** |

There is no Mailcow release range in which *every* registered MCP tool works. The matrix below is therefore **partially supported** for every compared tag. The broken tools are implementation mismatches that appear on all compared releases, not version-specific removals.

## How it was verified

1. Inventories of HTTP paths come from `src/api/endpoints.ts` and the API classes under `src/api/` that registered tools call (`src/index.ts`).
2. Unused API modules (`quarantine`, `oauth2`, `app-passwords`, `rspamd`, `tls-policy`, `spam`, `system` backup, `resources`) are **not** in the matrix. They are not registered as MCP tools.
3. For each tag below, `data/web/json_api.php` and (when present) `data/web/api/openapi.yaml` were downloaded from `github.com/mailcow/mailcow-dockerized` via the GitHub contents API.
4. Field names for mailbox/alias/filter/DKIM/mailq were checked in `data/web/inc/functions.mailbox.inc.php`, `functions.dkim.inc.php`, and `functions.mailq.inc.php` at `2026-09`, with targeted greps on earlier tags for `password2`, `sogo_visible`, `authsource`, and DKIM add fields.
5. OpenAPI is incomplete compared with `json_api.php` (for example `/api/v1/get/domain/all`, `/api/v1/get/alias/all`, `/api/v1/get/filters/all`, and `/api/v1/get/logs/{type}/{count}` are implemented but not all listed as those exact paths in OpenAPI `2026-09`). **`json_api.php` is treated as the source of truth.**
6. Not verified: HTTP status codes against a running Mailcow, API-key role differences beyond what the PHP `$_SESSION['mailcow_cc_role'] == "admin"` checks say, letter-suffix tags such as `2026-09a` as distinct from `2026-09`, and any release not listed in the matrix.

Compared tags: `2022-01`, `2022-04`, `2022-05` (version case only), `2022-12`, `2023-05`, `2023-12`, `2024-04`, `2024-11`, `2025-03`, `2025-09`, `2026-01`, `2026-09`, `2026-10`. Intermediate tags (`2026-09a`, `2026-07*`, …) were **not** downloaded; they are assumed to match the nearest compared major monthly tag and are marked unverified if that assumption matters.

## Release matrix

Legend:

- **partial** — core domain/mailbox/alias/filter/DKIM-get/log routes exist; tools listed under [Tools that fail on every compared release](#tools-that-fail-on-every-compared-release) still fail
- **unsupported** — not used (no compared tag is fully unsupported)
- **unverified** — source not compared

| Mailcow release | Status | What changes vs this MCP server |
|-----------------|--------|----------------------------------|
| `2026-10` | partial (source only) | Same used `json_api.php` routes as `2026-09`. Diff vs `2026-09` adds `ui_theme` only. **Not live-tested.** |
| `2026-09` / `2026-09a` | **partial — production target** | Baseline for package version `2026.9.1`. `2026-09` source was read in full for the files listed above. `2026-09a` itself was **not** downloaded (unverified letter suffix). |
| `2026-07` … `2026-03` | unverified | Monthly tags exist; files were not fetched. No evidence they removed the used routes. |
| `2026-01` | partial | Same used routes as `2026-09` in `json_api.php` (domain, mailbox, alias, filter, dkim, logs, mailq, syncjob write, syncjobs read, status/version). |
| `2025-12` … `2025-10` | unverified | Not downloaded. |
| `2025-09` | partial | Same used routes as `2026-01`. |
| `2025-07` … `2025-05` | unverified | Not downloaded. |
| `2025-03` | partial | Same used routes. `GET /api/v1/get/logs/cron` appears here (this MCP server does not call `cron`). Mailbox `authsource` is present; we do not send it (Mailcow default applies). |
| `2025-02` … `2024-05` | unverified except the rows below | — |
| `2024-11` | partial | Same used routes. No `case "cron"` under logs (irrelevant; we do not call it). No `authsource` in mailbox functions (we do not send it). |
| `2024-04` | partial | Same used routes as `2024-11` for this server. |
| `2023-12` | partial | Same used routes. `GET /api/v1/get/status/version` present. |
| `2023-05` | partial | Same used routes. |
| `2022-12` | partial | Same used routes. Version endpoint present. |
| `2022-11` … `2022-06` | unverified except version case | `case "version"` is present in `json_api.php` from `2022-05` onward (grep only). Full file not reviewed. |
| `2022-05` | partial | First compared tag with `GET /api/v1/get/status/version`. |
| `2022-04` | partial | Core used routes present. **No** `case "version"` under `status`. `get_mailcow_version` cannot read the instance version. |
| `2022-01` | partial | Oldest fully compared `json_api.php`. Core used routes present. No version endpoint. |
| `< 2022-01` | **unverified** | Tags such as `2021-*` were not found or not fetched. |

No compared tag **removed** a used route. There is therefore no “breaking range” of the form “works on 2024-x, broken on 2025-x” for the endpoints this server actually calls. The failures below are present on every compared tag.

## Endpoint inventory (registered tools)

Mailcow parses `/api/v1/{action}/{category}/{object}/{extra}` in `json_api.php`. Write JSON bodies are remapped:

- `add` — the entire JSON object becomes `attr`
- `edit` — only `attr` and `items` are copied out of the JSON object
- `delete` — the entire JSON body is decoded as `items`

### Present on every compared tag (`2022-01` … `2026-10`)

| MCP tools | Method + path this repo sends | Mailcow route | Notes |
|-----------|-------------------------------|---------------|-------|
| `list_domains`, `test_api_connection` | `GET /api/v1/get/domain/all` | `get` / `domain` / `all` | Implemented. Not listed as that exact path in OpenAPI `2026-09`. |
| `get_domain` | `GET /api/v1/get/domain/{id}` | `get` / `domain` / `{id}` | OpenAPI `2026-09`: `/api/v1/get/domain/{id}`. |
| `create_domain` | `POST /api/v1/add/domain` | `add` / `domain` | Body is `attr`. OpenAPI fields include `active`, `aliases`, `defquota`, `mailboxes`, `quota`, `maxquota`. Omitted `active` becomes `intval(undefined) === 0` (inactive). **Live create result unverified.** |
| `update_domain` | `POST /api/v1/edit/domain` with `{ items: [domain], attr }` | `edit` / `domain` | **Fixed in 2026.9.1** from `json_api.php` (edit unwraps only `items` + `attr`). Booleans sent as `"1"`/`"0"`. Live edit on `2026-09` **unverified**. |
| `delete_domain` | `POST /api/v1/delete/domain` with `["domain"]` | `delete` / `domain` | **Fixed in 2026.9.1.** `json_api.php` decodes the whole JSON body as `items` and passes them as `domain`. OpenAPI example is a bare name array. Live delete **unverified**. |
| `list_mailboxes` | `GET /api/v1/get/mailbox/all` | `get` / `mailbox` / `all` | Implemented. OpenAPI `2026-09` documents `/get/mailbox/all/{domain}` and `/get/mailbox/{id}` only. |
| `get_mailbox` | `GET /api/v1/get/mailbox/{id}` | `get` / `mailbox` / `{id}` | Matches `default` object branch. |
| `create_mailbox` | `POST /api/v1/add/mailbox` | `add` / `mailbox` | Sends `password2` (copied from `password` when omitted). `password2` exists in mailbox functions since at least `2022-01`. |
| `update_mailbox` | `POST /api/v1/edit/mailbox` with `{ items: [username], attr }` | `edit` / `mailbox` | **Fixed in 2026.9.1** from `json_api.php`. Password edits also send `password2`. Live edit **unverified**. |
| `delete_mailbox` | `POST /api/v1/delete/mailbox` with `["user@domain"]` | `delete` / `mailbox` | **Fixed in 2026.9.1.** Whole-body-as-items; items are usernames. Independently live-confirmed by a third-party fork (mailbox delete as a JSON username array). Their code was not copied. |
| `list_aliases` | `GET /api/v1/get/alias/all` | `get` / `alias` / `all` | Implemented. OpenAPI documents `/get/alias/{id}`. |
| `get_alias` | `GET /api/v1/get/alias/{id}` | `get` / `alias` / `{id}` | Matches. |
| `create_alias` | `POST /api/v1/add/alias` | `add` / `alias` | Sends `active` / `sogo_visible` as `"1"`/`"0"`. `sogo_visible` exists since at least `2022-01`. |
| `update_alias` | `POST /api/v1/edit/alias` with `{ items: [id], attr }` | `edit` / `alias` | Matches `json_api.php`. Independently live-confirmed by a third-party fork (alias edit `{items,attr}`). Their code was not copied. |
| `delete_alias` | `POST /api/v1/delete/alias` with `["id"]` | `delete` / `alias` | **Fixed in 2026.9.1** (was `{ items: [id] }`, which double-wraps). Independently live-confirmed by a third-party fork (alias delete as a JSON id array). Their code was not copied. |
| `list_sieve_filters` | `GET /api/v1/get/filters/all` or `/get/filters/{mailbox}` | `get` / `filters` | Implemented. Not in OpenAPI `2026-09` under that path. |
| `create_sieve_filter` | `POST /api/v1/add/filter` | `add` / `filter` | Fields `username`, `script_desc`, `script_data`, `filter_type`, `active` match `functions.mailbox.inc.php` at `2026-09`. |
| `update_sieve_filter` | `POST /api/v1/edit/filter` with `{ items, attr }` | `edit` / `filter` | Matches expected JSON shape. |
| `delete_sieve_filter` | `POST /api/v1/delete/filter` with `["id"]` | `delete` / `filter` | **Fixed in 2026.9.1.** Same whole-body-as-items pattern as alias (`id` => `$items`). Live delete **unverified**. |
| `list_dkim_keys`, `get_dkim_key` | `GET /api/v1/get/dkim/{domain}` (after listing domains) | `get` / `dkim` / `{domain}` | Correct. Mailcow has no DKIM list route; this server walks domains. Response fields `dkim_selector`, `key_length`/`dkim_txt` (via Redis) date from at least `2022-01`. |
| `create_dkim_key` | `POST /api/v1/add/dkim` with `{ domain, selector, key_size }` | `add` / `dkim` | Route exists. Mailcow reads `domains`, `dkim_selector`, `key_size` (same since `2022-01`). `domain` / `selector` are the wrong keys — create is expected to fail or no-op. |
| `get_logs` and siblings | `GET /api/v1/get/logs/{type}/{count}` | `get` / `logs` / `{type}` | Types this server maps: `postfix`, `dovecot`, `rspamd-history`, `sogo`, `api`, `acme`, `netfilter`, `watchdog`, `autodiscover`, `ratelimited`. All of those cases exist from `2022-01`. `cron` exists from `2025-03` and is unused. |
| `health_check`, `get_config` | (none) | — | Local process only. |
| `send_email`, `get_email_templates` | (none / simulated) | — | `send_email` does not call a Mailcow “send mail” API (Mailcow has none). Delivery status may call queue/log routes. |

### Version endpoint

| MCP tool | Path | First tag with the route | Notes |
|----------|------|--------------------------|-------|
| `get_mailcow_version` | `GET /api/v1/get/status/version` | **2022-05** | Admin-only (`$_SESSION['mailcow_cc_role'] == "admin"`). Returns `{"version": $GLOBALS['MAILCOW_GIT_VERSION']}`. OpenAPI example still shows `"2022-04"`. Unauthenticated / non-admin behaviour was **not** live-tested; PHP issues no JSON when the role check fails (empty body). |

### Missing or wrong on every compared tag

| MCP tools | Path / payload this repo sends | Mailcow | First/last seen |
|-----------|--------------------------------|---------|-----------------|
| `list_users`, `get_user`, `create_user`, `update_user`, `delete_user` | `/api/v1/{get,add,edit,delete}/user` | **No `case "user"`** in `json_api.php` on any compared tag. GET default is HTTP 404 `route not found`. Mailcow users *are* mailboxes. | Never present (`2022-01`…`2026-10`). |
| `list_sync_jobs`, `get_sync_job` | `GET /api/v1/get/syncjob` | GET category is **`syncjobs`** (plural). Documented path: `/api/v1/get/syncjobs/all/no_log`. Singular `/get/syncjob` hits the GET default 404. | Same on every compared tag. |
| `create_sync_job` | `POST /api/v1/add/syncjob` with `{ host, port, user, password, encryption, … }` | Route exists (`add` / `syncjob`). Mailcow fields are `host1`, `port1`, `user1`, `password1`, `enc1`, `mins_interval`, `username`, … (OpenAPI `2026-09` and add-example in `json_api` log). Our names do not match. | Same field names at `2026-09`; earlier OpenAPI examples were **not** fully diffed (**unverified** whether `host1` existed under another name before `2022-01`). |
| `update_sync_job`, `activate_sync_job`, `deactivate_sync_job` | `POST /api/v1/edit/syncjob` with `{ ...updates, id }` | Route exists. Edit JSON must be `{ items, attr }`. `active` must be `"1"`/`"0"` for `intval`. | All compared tags. |
| `delete_sync_job` | `POST /api/v1/delete/syncjob` with `[id]` | **Fixed in 2026.9.1** (`json_api.php` `delete` / `syncjob` → `id` => `$items`). Create/update field names and GET path are still wrong. | All compared tags. |
| `list_queue_items`, `get_queue_item` | `GET /api/v1/get/mailq` | GET `mailq` only handles `object === "all"`. Documented: `/api/v1/get/mailq/all`. Bare `/get/mailq` does not enter `case "all"` and returns no list. | All compared tags. |
| `flush_queue` | `POST /api/v1/edit/mailq` with `{}` | `mailq('edit')` requires `attr.action` in `flush` / `super_delete`. OpenAPI example is `{ action: flush }` (top-level). PHP JSON unwrap only copies `attr`/`items`. **Which shape works live is unverified.** Our empty body matches neither. | All compared tags. |
| `hold_queue_item` | `POST /api/v1/edit/mailq` with `{ action: hold, items }` | Same unwrap. Mailcow accepts `action` in `{hold, unhold, deliver}` *after* merge of `qid` + `attr`. |
| `release_queue_item` | `{ action: release, items }` | Mailcow action name is **`unhold`**, not `release`. |
| `delete_queue_items` | `POST /api/v1/delete/mailq` with `[qid, …]` | **Fixed in 2026.9.1** (`delete` / `mailq` → `qid` => `$items`). GET `/mailq` without `/all` and edit action names are still wrong. |
| `update_dkim_key` (and activate/deactivate helpers) | `POST /api/v1/edit/dkim` | **No `case "dkim"` under `edit`** on any compared tag. HTTP 404 `route not found`. DKIM is add / delete / get only. | Never present. |
| `delete_dkim_key` | `POST /api/v1/delete/dkim` with `[domain]` | **Fixed in 2026.9.1** (`delete` / `dkim` → `domains` => `$items`). Selector is unused by Mailcow delete. Create field names and `/edit/dkim` are still wrong. | All compared tags. |

## Fields that appeared, changed, or were removed

Only fields this server sends or reads are listed. “Unverified first tag” means the field exists at the oldest file we opened for that symbol, but we did not bisect every monthly tag.

| Field | Used by | History (verified) |
|-------|---------|--------------------|
| `password2` | create/update mailbox | Present in `functions.mailbox.inc.php` at `2022-01`, `2022-05`, `2023-12`, `2025-03`, `2026-09`. OpenAPI `2026-09` documents it. **Not removed.** First appearance before `2022-01`: unverified. |
| `sogo_visible` | create/update alias | Present in mailbox functions at the same tags as `password2`. **Not removed.** |
| `authsource` | (not sent) | Absent at `2023-12`, present at `2025-03` and `2026-09`. We omit it; Mailcow defaults to `mailcow`. No tool break. |
| DKIM add: `domains`, `dkim_selector`, `key_size` | create DKIM | Same names at `2022-01` and `2026-09`. This server sends `domain` / `selector` instead. |
| DKIM get: `dkim_selector`, `dkim_txt` / pubkey material | get/list DKIM | `dkim('details')` at `2026-09` fills `dkim_selector` (and optional `privkey`). OpenAPI `/get/dkim/{domain}` exists at `2026-09`. |
| Filter add: `username`, `script_desc`, `script_data`, `filter_type` | sieve tools | Present in mailbox functions at `2026-09`. Earlier-tag field names: **unverified** (route `add/filter` exists since `2022-01`). |
| Sync job add: `host1`, `user1`, `password1`, `enc1`, … | sync job create | Documented in OpenAPI `2026-09`. This server’s TypeScript types use `host`, `user`, `password`, `encryption`. |
| Mailq edit actions | queue tools | `2026-09` `functions.mailq.inc.php`: `hold`, `unhold`, `deliver`, `flush`, `super_delete`. No `release`. |
| `GET /status/version` | `get_mailcow_version` | Added Mailcow PR 4557, first monthly tag **2022-05**. Still present at `2026-10`. |
| Log type `cron` | (unused) | First seen in compared `json_api.php` at **2025-03**. |
| `case "user"` | user tools | **Never present** in compared tags. Not a removal. |

No used field was found to have been **removed** between `2022-01` and `2026-10`.

## Tools that fail on every compared release

These are expected to break against production Mailcow `2026-09` for the reasons above. That expectation is from source, not a live call.

| Tools | Why |
|-------|-----|
| `list_users`, `get_user`, `create_user`, `update_user`, `delete_user` | `/user` is not a Mailcow API category. Use mailbox tools. |
| `list_sync_jobs`, `get_sync_job` | Wrong GET path (`/get/syncjob` vs `/get/syncjobs/all/no_log`). |
| `create_sync_job`, `update_sync_job`, `activate_sync_job`, `deactivate_sync_job` | Wrong field names and/or missing `{ items, attr }` on edit. `delete_sync_job` now sends `[id]`. |
| `list_queue_items`, `get_queue_item` | Missing `/all` on `/get/mailq`. |
| `flush_queue`, `hold_queue_item`, `release_queue_item` | Edit payload / action name (`release` vs `unhold`) does not match `mailq()`. |
| `update_dkim_key` | `/edit/dkim` does not exist. |
| `create_dkim_key` | Sends `domain`/`selector` instead of `domains`/`dkim_selector`. |

Domain/mailbox/alias **list, get, create, edit, and delete** now match the `json_api.php` write shapes (edit `{items,attr}`, delete a plain item array). Sieve list/create/update/delete match as well. Logs match. **Live success on production `2026-09` remains unverified** except where a third-party fork reported a live Mailcow test of mailbox/alias delete and alias edit (their implementation was not copied).

## Unused modules (not compatibility-tested)

`src/api/` also contains clients for quarantine, OAuth2, app passwords, Rspamd, TLS policy, spam settings, system backup, and generic resources. Those paths were **not** audited against Mailcow tags because no MCP tool registers them. Treat them as **unverified**.

## Versioning

See [README](README.md#versioning) and [CHANGELOG.md](CHANGELOG.md). Package version `YYYY.MM.PATCH` names the Mailcow `YYYY-MM` release this tree was source-verified against. `2026.9.1` is an MCP-only PATCH on the `2026-09` target (npm semver cannot encode `2026.09.0`).
