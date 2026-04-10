# SeasonalNet Discord Bot

Shared SeasonalNet Discord bot for:

- utility
- moderation
- agents

The bot keeps the Discord layer thin and pushes real business logic into backend services, especially `seasonal-agent`.

## What is intentionally in scope

- shared bot shell
- slash command loader
- utility commands
- moderation workflows
- agent-backed `/ask`
- SQLite-backed audit log
- YAML config plus `.env` secrets

## What is intentionally out of scope

- PBX admin actions
- SeasonalWeather control logic
- giant bot-local JSON state
- duplicating backend business logic inside Discord commands

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

- `/ask target:<configured target> question:<text>`

## Seasonal agent integration

The agent module expects a bot-scoped backend token and uses the bot chat route on the Seasonal Agent API.

The bot now sends explicit agent routing details upstream:
- `target`
- `agent_profile`
- lightweight request metadata describing the Discord source

Agent routing targets are configured in `config.yaml` under `agents.targets`. The shipped defaults are `seasonalnet`, `homelab`, and `repo`.
