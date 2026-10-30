# Mailcow MCP Server

TypeScript [Model Context Protocol](https://modelcontextprotocol.io/) server for [Mailcow](https://mailcow.email/) email management.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP_SDK-1.32-green.svg)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2026.10.0-informational.svg)](CHANGELOG.md)

This repository is a fork of [leolilley/mailcow_mcp](https://github.com/leolilley/mailcow_mcp) (MIT, Copyright leolilley). This tree is also MIT — see [LICENSE](LICENSE).

Mailcow’s HTTP API is **action-based** (`/api/v1/{get,add,edit,delete}/…`), not REST. See [COMPATIBILITY.md](COMPATIBILITY.md) for which tools match Mailcow source. No compared Mailcow release is fully supported.

## Features

- **47 MCP tools** for domains, mailboxes, aliases, sieve filters, DKIM, queues, sync jobs, logs, and a small simulated send path
- **`X-API-Key` authentication** against a Mailcow instance
- **Mailcow-aligned versioning** (`YYYY.MM.PATCH`) plus `get_mailcow_version`
- **stdio MCP transport** — production entry point is `node dist/index.js`

Removed (not Mailcow categories / routes): `list_users`, `get_user`, `create_user`, `update_user`, `delete_user`, and `update_dkim_key`. Users *are* mailboxes. Rotate DKIM with `delete_dkim_key` then `create_dkim_key`.

## Quick start

Requires **Node.js 20+** and a Mailcow API key.

```bash
npm install
cp .env.example .env
# set MAILCOW_API_URL and MAILCOW_API_KEY

npm run build
npm start
# same as: node dist/index.js
```

The server speaks MCP over **stdio** (not HTTP on `MCP_SERVER_PORT`). Point an MCP client at the built file:

```json
{
  "command": "node",
  "args": ["dist/index.js"],
  "env": {
    "MAILCOW_API_URL": "https://your-mailcow-server.com",
    "MAILCOW_API_KEY": "your-api-key"
  }
}
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MAILCOW_API_URL` | yes | — | Mailcow base URL |
| `MAILCOW_API_KEY` | yes (for API tools) | — | `X-API-Key` value |
| `MAILCOW_API_ACCESS_TYPE` | no | `read-write` | `read-only` or `read-write` |
| `MAILCOW_VERIFY_SSL` | no | `true` | TLS certificate check |
| `MCP_SERVER_PORT` | no | `3000` | Stored in config only; this process is stdio |
| `MCP_LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error` |

Copy [`.env.example`](.env.example). Details: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Available tools (47)

### System (4)

`health_check`, `get_config`, `get_mailcow_version`, `test_api_connection`

`get_mailcow_version` reports this package version, the tested Mailcow release (`2026-10`), and — with an admin API key — `GET /api/v1/get/status/version`, plus a mismatch warning.

### Mailcow resources

| Group | Tools | Notes |
|-------|-------|--------|
| **Domains** | `list_domains`, `get_domain`, `create_domain`, `update_domain`, `delete_domain` | 5 |
| **Mailboxes** | `list_mailboxes`, `get_mailbox`, `create_mailbox`, `update_mailbox`, `delete_mailbox` | 5. Replaces the removed `/user` tools |
| **Aliases** | `list_aliases`, `get_alias`, `create_alias`, `update_alias`, `delete_alias` | 5 |
| **Sieve filters** | `list_sieve_filters`, `create_sieve_filter`, `update_sieve_filter`, `delete_sieve_filter` | 4 |
| **DKIM** | `list_dkim_keys`, `get_dkim_key`, `create_dkim_key`, `delete_dkim_key` | 4. No `update_dkim_key` (`/edit/dkim` does not exist) |
| **Queues** | `list_queue_items`, `get_queue_item`, `flush_queue`, `delete_queue_items`, `hold_queue_item`, `release_queue_item` | 6. Release is Mailcow `unhold` |
| **Sync jobs** | `list_sync_jobs`, `get_sync_job`, `create_sync_job`, `update_sync_job`, `delete_sync_job`, `activate_sync_job`, `deactivate_sync_job` | 7. Create/edit field names still mismatched — see COMPATIBILITY |
| **Logs** | `get_logs`, `get_error_logs`, `get_performance_logs`, `get_access_logs` | 4 |
| **Email (simulated)** | `send_email`, `check_email_status`, `get_email_templates` | 3. Mailcow has no send-mail API |

Full parameter lists: [docs/API_REFERENCE.md](docs/API_REFERENCE.md). What actually works against Mailcow source: [COMPATIBILITY.md](COMPATIBILITY.md).

## Versioning

This package uses **`YYYY.MM.PATCH`**, not a conventional `0.x` line.

| Part | Meaning |
|------|---------|
| `YYYY.MM` | Newest [mailcow-dockerized](https://github.com/mailcow/mailcow-dockerized) monthly release this build was **source-verified** against |
| `PATCH` | MCP-only fixes or docs that do not move the Mailcow target |

Mailcow tags look like `2026-10` or `2026-09a`. [npm semver](https://docs.npmjs.com/about-semantic-versioning) **rejects a leading zero** in a numeric component, so `2026.09.0` is not a valid npm version. The month is unpadded: Mailcow `2026-09` → npm **`2026.9.0`**, Mailcow `2026-10` → npm **`2026.10.0`**. This build is **`2026.10.0`**.

The MCP server advertises that version in protocol `serverInfo`, in `health_check` / `get_config`, and via `get_mailcow_version`.

## Install and build

```bash
# install
npm install

# production build → dist/index.js
npm run build
npm start                 # node dist/index.js

# development (ts-node, auto-reload is not a watcher — rerun after edits)
npm run dev

# tests
npm test
npm run test:all          # unit + tsc + server startup
npm run test:coverage

# lint / format
npm run lint
npm run format
```

## Documentation

| Document | Purpose |
|----------|---------|
| [Quick Start](docs/QUICK_START.md) | First run |
| [Architecture](docs/ARCHITECTURE.md) | Layout |
| [API Reference](docs/API_REFERENCE.md) | Tool parameters |
| [Configuration](docs/CONFIGURATION.md) | Environment |
| [Testing](docs/TESTING.md) | Test commands |
| [COMPATIBILITY.md](COMPATIBILITY.md) | Mailcow release matrix (source-verified; live reads listed) |
| [CHANGELOG.md](CHANGELOG.md) | Released versions |
| [CLAUDE.md](CLAUDE.md) | Session notes for agents |

## Security

- Mailcow API key via `X-API-Key`
- Permission strings per resource (`domains:read`, `mailboxes:write`, …)
- JSON Schema input validation on tools
- Optional SSL verification (`MAILCOW_VERIFY_SSL`)

## License

[MIT](LICENSE). Copyright leolilley.

Upstream: [leolilley/mailcow_mcp](https://github.com/leolilley/mailcow_mcp).

## Support

- Docs: [docs/README.md](docs/README.md)
- Issues: [MaDie/mailcow_mcp](https://github.com/MaDie/mailcow_mcp/issues)
