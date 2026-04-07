# SeasonalNet Discord Bot

Shared SeasonalNet Discord bot starter scaffold for:

- utility
- moderation
- agents

This starter keeps the Discord layer thin and pushes real business logic into backend services, especially `seasonal-agent`.

## What is intentionally in scope

- shared bot shell
- slash command loader
- utility commands
- moderation workflows
- agent-backed `/ask`
- SQLite-backed audit log
- YAML config plus `.env` secrets

## What is intentionally out of scope in this starter

- PBX admin actions
- SeasonalWeather control logic
- giant bot-local JSON state
- duplicating backend business logic inside Discord commands

## Stack

- Node.js
- TypeScript
- `discord.js`
- built-in `node:sqlite`
- `yaml`
- `dotenv`

## Layout

```text
seasonalnet-discord-bot/
  AGENTS.md
  README.md
  config.yaml.example
  .env.example
  package.json
  tsconfig.json
  scripts/
  src/
    core/
    integrations/
    modules/
      utility/
      moderation/
      agents/
    storage/
    ui/
```

## Quick start

1. Copy the example config files.

```bash
cp .env.example .env
cp config.yaml.example config.yaml
```

2. Fill in:

- `SEASONALNET_BOT_TOKEN`
- `SEASONALNET_BOT_CLIENT_ID`
- `SEASONALNET_BOT_GUILD_ID`
- `SEASONAL_AGENT_BOT_TOKEN`
- real guild and role IDs in `config.yaml`

3. Install dependencies and build.

```bash
npm install
npm run build
```

4. Deploy slash commands to the configured guild allowlist while developing.

```bash
npm run deploy:commands
```

Set `SEASONALNET_BOT_DEPLOY_GLOBAL=true` only when you explicitly want global command deployment.

5. Start the bot.

```bash
npm run start
```

## Configuration model

- `config.yaml` holds non-secret runtime settings
- `.env` holds secrets and environment-specific values
- SQLite stores audit log and local bot state

## Authorization model

- command metadata declares the required scope
- the core dispatcher enforces that scope before command execution
- `allowed_guild_ids` gates which guilds may use the bot
- scope grants should prefer `role_ids` over `role_names`
- `moderation.manage` implies the concrete moderation scopes

## Included commands

### Utility

- `/help`
- `/about`
- `/ping`
- `/health`
- `/version`

### Moderation

- `/lock`
- `/unlock`
- `/slowmode`
- `/purge`
- `/timeout`

### Agents

- `/ask target:<seasonalnet|homelab> question:<text>`

## SQLite

The database is created automatically and migrations are applied at startup.

Current tables:

- `schema_migrations`
- `command_audit`
- `moderation_actions`
- `agent_sessions`

## Seasonal agent integration

The agent module expects a bot-scoped backend token and uses the bot chat route on the Seasonal Agent API.

## Development notes

- Prefer guild-scoped command deployment while testing.
- Keep deterministic behavior in structured services, not in Discord handlers.
- Treat the bot as a workflow front door, not a logic monolith.
- Avoid Discord `Administrator` as a shortcut for bot scopes.

## Systemd

A sample unit file is included in `systemd/seasonalnet-discord-bot.service`.
