# SeasonalNet Discord Bot

Shared SeasonalNet Discord bot for utility, moderation, welcome automation, and agent-backed workflows.

This repository is the Discord front door for SeasonalNet. It is intentionally thin: command handling, access control, audit logging, and message formatting live here, while heavier logic is expected to stay in backend services such as `seasonal-agent`.

## What this bot does

- Registers and serves Discord slash commands
- Enforces scope-based access control by guild, role ID, and role name
- Records command and moderation audit history in SQLite
- Provides utility and moderation workflows for guild operations
- Relays `/ask` requests to `seasonal-agent` using explicit target/profile routing
- Sends configurable welcome messages in-channel, by DM, or both
- Uses YAML for non-secret configuration and `.env` for secrets

## Current feature set

### Utility

- `/help`
- `/about`
- `/ping`
- `/whoami`
- `/health`
- `/scopes`
- `/audit`
- `/modlog`
- `/version`

### Moderation

- `/lock`
- `/unlock`
- `/slowmode`
- `/purge`
- `/warn`
- `/note`
- `/history`
- `/case`
- `/timeout`
- `/untimeout`
- `/kick`
- `/ban`
- `/softban`
- `/unban`

### Agents

- `/ask target:<configured target> question:<text>`

### Passive behavior

- Guild welcome messages when the welcome module is enabled in config

## Design boundaries

In scope:

- shared bot shell
- command registration and dispatch
- utility workflows
- moderation workflows
- welcome automation
- agent-backed `/ask`
- audit logging and lightweight session tracking

Out of scope:

- putting SeasonalWeather, PBX, or other infrastructure business logic directly in this bot
- ad-hoc JSON files for persistent state
- treating the Discord layer as the system of record
- replacing backend APIs with Discord command logic

## Repository layout

```text
.
├── AGENTS.md
├── config.yaml.example
├── package.json
├── scripts/
│   └── deploy-commands.ts
├── src/
│   ├── core/
│   ├── integrations/
│   ├── modules/
│   │   ├── agents/
│   │   ├── moderation/
│   │   ├── utility/
│   │   └── welcome/
│   ├── storage/
│   └── ui/
└── systemd/
    └── seasonalnet-discord-bot.service
```

## Requirements

- Linux host
- Node.js **22.12.0 or newer**
- npm
- A Discord application and bot token
- A writable path for the SQLite database
- A configured `seasonal-agent` backend if `/ask` is enabled
- `systemd` for the included service unit example

## Configuration model

This repo uses two configuration layers:

- `config.yaml` for non-secret operational settings
- `.env` for secrets and environment-specific values

At runtime, the bot loads:

1. `.env` from the working directory
2. `config.yaml` from the working directory
3. or an override path from `SEASONALNET_BOT_CONFIG`

### Required environment variables

Create a `.env` file in the repo root with at least:

```dotenv
SEASONALNET_BOT_TOKEN=your_discord_bot_token
SEASONALNET_BOT_CLIENT_ID=your_discord_application_client_id
SEASONALNET_BOT_GUILD_ID=your_primary_guild_id
SEASONAL_AGENT_BOT_TOKEN=your_seasonal_agent_bot_token
```

Notes:

- `SEASONALNET_BOT_GUILD_ID` is used by the command deployment script for guild-scoped command registration.
- `SEASONAL_AGENT_BOT_TOKEN` is currently expected at startup by the runtime in the current codebase.
- To load config from a non-default path, set `SEASONALNET_BOT_CONFIG=/absolute/path/to/config.yaml`.

### Required Discord developer portal settings

Enable these for the bot application as needed:

- **Server Members Intent** if the welcome module is enabled
- Slash command installation for the target guild or globally, depending on deployment model

## Example config workflow

Start from the shipped example:

```bash
cp config.yaml.example config.yaml
```

Then edit at least these sections:

### `bot`

- `allowed_guild_ids`: guilds where the bot is allowed to operate
- `status`: Discord presence status
- `presence.activities`: rotating presence entries

### `database`

- `path`: SQLite database path, for example `/var/lib/seasonalnet/discord-bot/bot.db`

### `scopes`

- `defaults`: scopes granted to everyone
- `grants`: role- or guild-based scope grants

### `integrations.seasonal_agent`

- `enabled`: whether the integration is intended to be active
- `base_url`: Seasonal Agent API base URL
- `timeout_ms`: upstream timeout
- `bot_token_env`: env var name holding the backend token

### `agents`

- `default_target`
- `max_question_length`
- `targets.<id>.display_name`
- `targets.<id>.description`
- `targets.<id>.agent_profile`
- `targets.<id>.enabled`

### `moderation`

- `max_purge_count`
- lock/unlock default reasons
- DM notice templates and footer

### `welcome`

- top-level `enabled`
- per-guild welcome settings
- delivery mode: `channel`, `dm`, or `channel_and_dm`
- `channel_id`, template text, mention behavior, and optional auto-delete timing

### `cdn`

- `icon_base_url` for Lucide icon image rendering

## Local development

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Type-check:

```bash
pnpm check
```

Run in development mode:

```bash
pnpm dev
```

Build production output:

```bash
pnpm build
```

Run the built bot manually:

```bash
pnpm start
```

## Docker

The repository includes a production multi-stage Dockerfile. It compiles the
TypeScript source and keeps only production dependencies in the runtime image.
Secrets remain runtime environment variables; do not copy `.env` into the
image.

```bash
docker build -t seasonalnet/discord-bot:local .
docker run --rm \
  --env-file .env \
  -v "$PWD/config.yaml:/run/config/seasonalnet-discord-bot.yaml:ro" \
  seasonalnet/discord-bot:local
```

For a persistent deployment, mount the configured SQLite parent directory at
`/var/lib/seasonalnet/discord-bot` and set `database.path` accordingly. The
cross-repository Compose dev deployment intentionally uses ephemeral `/tmp`
state instead.

## Slash command deployment

Commands must be deployed to Discord before use.

For a normal guild-scoped deployment:

```bash
pnpm deploy:commands
```

The deploy script will use guild IDs from:

- `SEASONALNET_BOT_GUILD_ID`, if set
- `bot.allowed_guild_ids` in `config.yaml`

Global deployment is intentionally guarded. If you truly want global command registration and have not configured any guild targets, set:

```bash
SEASONALNET_BOT_DEPLOY_GLOBAL=true pnpm deploy:commands
```

## Production deployment

A typical production layout:

```text
/opt/seasonalnet/discord-bot      # application checkout
/opt/seasonalnet/discord-bot/.env # secrets
/opt/seasonalnet/discord-bot/config.yaml
/var/lib/seasonalnet/discord-bot  # SQLite state
```

Example deployment sequence:

```bash
git clone <repo-url> /opt/seasonalnet/discord-bot
cd /opt/seasonalnet/discord-bot
cp config.yaml.example config.yaml
pnpm install --frozen-lockfile
pnpm build
```

Create `.env`, adjust `config.yaml`, then deploy commands:

```bash
pnpm deploy:commands
```

After that, install the service unit and start the bot.

## systemd service

This repo ships an example unit at `systemd/seasonalnet-discord-bot.service`.

Install it:

```bash
sudo cp systemd/seasonalnet-discord-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seasonalnet-discord-bot.service
```

Check service state:

```bash
systemctl status seasonalnet-discord-bot.service --no-pager
journalctl -u seasonalnet-discord-bot.service -n 100 --no-pager
```

Important:

- The example unit uses `User=seasonal` and `Group=seasonal`.
- Adjust the user, group, and working directory to match your host.
- The bot loads `.env` from the working directory via `dotenv`, so keep `.env` readable by the service account.
- Ensure the configured database path is writable by the service account.

## SQLite behavior

The bot uses Node's built-in SQLite support through `node:sqlite`.

On startup it will:

- create the parent directory for the configured database path if needed
- open the SQLite database
- enable WAL journal mode
- create and apply built-in schema migrations automatically

Tracked data includes:

- command audit history
- moderation action history
- lightweight agent session tracking

## Seasonal Agent integration

The `/ask` command forwards requests to Seasonal Agent with explicit routing fields rather than prompt-only steering.

Each request includes:

- `target`
- `agent_profile`
- stable Discord-derived `session_id`
- request metadata identifying the Discord source and transport

Default target IDs in the example config are:

- `seasonalnet`
- `homelab`
- `repo`

The bot is intended to stay thin here. Backend behavior should be selected by config and API fields, not by Discord-side prompt shaping.

## Welcome module notes

The welcome module is disabled by default.

When enabled, it supports:

- in-channel welcomes
- DM welcomes
- combined delivery
- per-guild templates
- optional public-message auto-delete
- token substitution such as `{user_mention}`, `{user_tag}`, `{guild_name}`, and `{member_count}`

Because it listens for member join events, **Server Members Intent** must be enabled both in the Discord developer portal and in the runtime client configuration used by the bot.

## Operational notes

- Scope enforcement is centralized in the runtime and applies per command.
- The bot refuses access in guilds not listed in `bot.allowed_guild_ids` when that list is populated.
- The repo is built around YAML config plus `.env`; it should not accumulate random runtime JSON state.
- The Discord layer is expected to remain a front end for SeasonalNet services, not an alternate backend.

## Troubleshooting

### Bot starts but commands do not appear

- Confirm `pnpm deploy:commands` was run successfully
- Confirm `SEASONALNET_BOT_CLIENT_ID` is correct
- Confirm the bot is installed in the target guild
- Confirm the guild ID used for deployment matches the actual server

### Bot fails on startup

- Confirm `.env` exists in the working directory
- Confirm all required environment variables are present
- Confirm `config.yaml` exists, or intentionally rely on defaults
- Confirm the database path is writable
- Confirm the build output exists at `dist/src/index.js`

### `/ask` fails

- Confirm `seasonal-agent` is reachable at `integrations.seasonal_agent.base_url`
- Confirm `SEASONAL_AGENT_BOT_TOKEN` is present and valid
- Confirm the configured target is enabled in `agents.targets`
- Confirm the upstream Seasonal Agent profile exists and accepts the request

### Welcome messages do not send

- Confirm `welcome.enabled: true`
- Confirm the target guild is configured under `welcome.guilds`
- Confirm `channel_id` is valid for channel-based delivery
- Confirm the bot has permission to send messages in the configured channel
- Confirm Server Members Intent is enabled

## Notes for operators

This README is meant for humans operating or extending the repository.

For agent-facing repo rules and architectural expectations, read `AGENTS.md`.
