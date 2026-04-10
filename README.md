# SeasonalNet Discord Bot

Shared SeasonalNet Discord bot for:

- utility
- moderation
- agents
- welcome automation

The bot keeps the Discord layer thin and pushes real business logic into backend services, especially `seasonal-agent`.

## What is intentionally in scope

- shared bot shell
- slash command loader
- utility commands
- moderation workflows
- agent-backed `/ask`
- config-driven welcome automation
- SQLite-backed audit log
- YAML config plus `.env` secrets

## What is intentionally out of scope

- PBX admin actions
- SeasonalWeather control logic
- giant bot-local JSON state
- duplicating backend business logic inside Discord commands

## Included commands

Passive module behavior is also supported through the same `/modules` loader. Current passive behavior includes guild welcome messages when configured.


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

- `/ask target:<configured target> question:<text>`

## Seasonal agent integration

The agent module expects a bot-scoped backend token and uses the bot chat route on the Seasonal Agent API.

The bot now sends explicit agent routing details upstream:
- `target`
- `agent_profile`
- lightweight request metadata describing the Discord source

Agent routing targets are configured in `config.yaml` under `agents.targets`. The shipped defaults are `seasonalnet`, `homelab`, and `repo`.

## Welcome module

The welcome module is config-driven and disabled by default.

It currently supports:
- channel welcome messages
- DM welcome messages
- combined channel + DM delivery
- per-guild configuration
- optional auto-delete for public welcome messages
- tokenized templates: `{user_mention}`, `{user_tag}`, `{user_id}`, `{guild_name}`, `{member_count}`

Because it listens for member join events, the bot now needs the **Server Members Intent** enabled in the Discord developer portal and in the runtime client configuration.
