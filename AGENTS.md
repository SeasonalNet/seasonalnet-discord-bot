# AGENTS.md — SeasonalNet Discord Bot

## Purpose

This repository contains the shared SeasonalNet Discord bot.

The bot is a **workflow front door** for Discord, not the source of truth for infrastructure, PBX, weather, or agent reasoning.

## Current scope

The current bot intentionally covers phases 1 through 3:

1. shared core
2. utility + moderation
3. agents

Anything beyond that should be treated as follow-on work, not something to casually stuff into the bot.

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

## Agent integration guidance

Current design expects the Discord bot to call `seasonal-agent` with a bot-scoped token.

Session IDs should stay stable and predictable.

Default pattern:
- per-user in channel
- include target namespace so parallel sessions do not collide

Example:
`discord:<guild_id>:<channel_id>:<user_id>:target:<target>`

When calling `seasonal-agent`, pass both:
- `target` for the bot-selected workflow target
- `agent_profile` for the backend profile selection

The Discord bot should not decide backend behavior by prompt text. It should route by explicit upstream fields.

Agent routing targets should be config-driven. Do not hard-code target lists in slash command handlers when the backend can expose additional profiles over time.
