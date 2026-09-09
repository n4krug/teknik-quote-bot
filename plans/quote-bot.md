# Quote Bot — random message from a channel

## Goal

Create a Discord bot that, on request, pulls a random message from a specified
channel and reposts it so people can rediscover funny or notable things said
earlier. The channel should be configurable server-wide as a default, with the
option to name a different channel at call time.

## Scope

- A runnable TypeScript + discord.js bot project from an empty directory.
- One slash command that returns a random message from a channel, with a link
  back to the original.
- A configured default channel (via environment config), overridable per
  invocation with an optional channel argument.
- Environment-based configuration for the bot token/client id, with startup
  validation.
- Containerized run path (Dockerfile + compose) so it can be started without a
  local Node toolchain.
- Command registration path so the slash command actually shows up in Discord.

## Non-goals

- No database or persistent storage of quotes.
- No "best of" / quote-of-the-day scheduling or cron posting.
- No reaction-based or automatic message collection.
- No web dashboard or admin UI.
- No multi-guild settings store (a single default channel via config only).
- No test suite, lint, or CI in this pass.

## Affected areas

Greenfield project — everything is new. The structure will cover:

- Project manifest and TypeScript build configuration
- Bot entrypoint / client bootstrap and command loading
- Slash command definition and its handler
- Configuration module (env parsing + validation)
- Containerization files and local ignore/env example files

## Open questions / risks

- **History depth.** Reading a channel's full history can be slow or rate-limited
  on large channels. Need a bounded strategy (e.g. cap how far back / how many
  messages are considered) — exact limit TBD at implementation time.
- **Permissions.** The bot needs message history + read access in the target
  channel, and must fail with a clear message when it doesn't.
- **Content filtering.** Should bot messages, empty messages, system messages,
  and command calls themselves be excluded from the random pick? Assumed yes.
- **Message age.** Should very recent messages (including the command call
  itself) be excluded? Leaning yes.
- **Attachments/embeds.** Unclear whether to repost attachments or only text
  plus a jump link.
