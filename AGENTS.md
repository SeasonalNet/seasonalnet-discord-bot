# AGENTS.md — SeasonalNet Discord Bot

## Purpose

This repository contains the shared SeasonalNet Discord bot starter.

The bot is a **workflow front door** for Discord, not the source of truth for infrastructure, PBX, weather, or agent reasoning.

## Current scope

The starter intentionally covers phases 1 through 3:

1. shared core
2. utility + moderation
3. agents

Anything beyond that should be treated as follow-on work, not something to casually stuff into the starter.

## Architectural rules

1. Keep the Discord layer thin.
2. Keep feature modules thin.
3. Put real logic in backend services.
4. Prefer deterministic API routes over agent chat when exact data exists.
5. Use agent chat only when summarization, explanation, or fuzzy reasoning is useful.
6. Use SQLite for local bot state and audit trails.
7. Use `config.yaml` for non-secret config.
8. Use `.env` for secrets and environment-specific values.
9. Do not introduce ad-hoc JSON files for persistent state.
10. Do not treat this repo as a dumping ground for every SeasonalNet workflow.

## Explicit non-goals

- Replacing the existing SeasonalPBX Discord bot without a deliberate migration plan
- Embedding PBX admin workflows directly into this starter
- Embedding SeasonalWeather operational logic directly into this starter
- Building a giant “god bot” full of unrelated platform logic

## Preferred growth path

### Allowed near-term work
- refine utility responses
- expand moderation workflows
- improve audit logging
- improve scope mapping
- improve agent formatting
- add a small homelab module later if structured routes justify it

### Avoid unless explicitly requested
- PBX module
- weather module
- forgejo module
- authentik module
- ticket systems
- dashboard logic

## Module boundaries

### `src/core/`
Shared infrastructure:
- config loading
- logging
- scope checks
- HTTP helpers
- command routing
- interaction context
- errors

Do not place feature behavior here.

### `src/integrations/`
Thin clients for upstream services.
They may:
- add auth headers
- call APIs
- normalize upstream failures
- return plain typed data

They may not:
- contain Discord interaction logic
- format embeds
- hold business policy

### `src/modules/`
Feature entrypoints and feature-local services.

They may:
- define slash commands
- validate user input
- check bot scopes
- call integrations
- render user-facing replies

They may not:
- become mini-platforms
- reimplement backend logic
- own cross-module shared infrastructure

### `src/storage/`
Only bot-local persistence:
- audit trail
- local session linkage
- lightweight preferences or caches later

Never use this as the source of truth for homelab, PBX, or weather state.

## Scopes

Use **scopes** consistently, not a second vocabulary.

Examples:
- `utility.use`
- `agents.use`
- `moderation.manage`
- `moderation.lock`
- `moderation.slowmode`
- `moderation.purge`
- `moderation.timeout`

Discord-side scopes control who may use commands.
Backend-side scopes control what the bot token may do upstream.

A Discord permission grant must not automatically imply unlimited upstream power.

## Agent integration guidance

Current design expects the Discord bot to call `seasonal-agent` with a bot-scoped token.

Session IDs should stay stable and predictable.

Default pattern:
- per-user in channel
- include target namespace so parallel sessions do not collide

Example:
`discord:<guild_id>:<channel_id>:<user_id>:target:<target>`

## Response guidance

### Utility
Short, clean, direct.

### Moderation
Clear success/failure and what changed.

### Agent responses
Answer first, optional detail second.

Avoid giant walls of text when replying in Discord.

## Logging guidance

Record:
- timestamp
- command name
- user id
- guild id
- channel id
- success/failure
- latency
- error summary when relevant

Never log:
- secrets
- bearer tokens
- raw upstream auth headers

## If you add a new feature

Ask these questions first:

1. Is this actually in current scope?
2. Does it belong in the bot, or in a backend service?
3. Can it reuse an existing module pattern?
4. Does it need a new upstream scope?
5. Does it need database storage, or is that unnecessary?

If the answer trends toward “this is big platform logic,” stop and move it to a service instead.

## Style guidance

- Prefer small files with clear responsibilities.
- Prefer plain TypeScript over clever abstractions.
- Prefer explicit behavior over magic.
- Prefer boring reliability over ambitious sprawl.
