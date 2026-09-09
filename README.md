# quote-bot

Discord bot that posts a random message from a channel.

## Setup

1. Create an app + bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Invite it with the `bot` + `applications.commands` scopes and the
   **Read Message History** and **Send Messages** permissions.
3. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and
   `DISCORD_CLIENT_ID`. Set `QUOTE_CHANNEL_ID` to the default channel and
   `GUILD_ID` if you want instant (guild-scoped) command registration.

## Usage

```bash
npm install
npm run deploy   # register the slash command
npm run dev      # run in watch mode
```

Commands:

- `/quote` — random message from the configured default channel
- `/quote channel:#some-channel` — random message from a specific channel

## CLI

Print a random message as JSON and exit, without running the bot:

```bash
npm run quote                    # uses QUOTE_CHANNEL_ID
npm run quote -- 123456789012345678   # or pass a channel ID
```

Output:

```json
{
  "content": "hello world",
  "author": { "id": "...", "username": "...", "displayName": "...", "avatarURL": "..." },
  "channelId": "...",
  "guildId": "...",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "url": "https://discord.com/channels/.../.../...",
  "attachments": [],
  "imageUrl": null
}
```

Exits `1` with a message on stderr if the channel is empty, unknown, or
inaccessible. The CLI talks to the Discord REST API only — it opens no gateway
connection, so it will not disconnect a running bot instance.

The same filtering config applies (`QUOTE_HISTORY_LIMIT`, `QUOTE_EXCLUDE_BOTS`,
`QUOTE_MIN_AGE_SECONDS`).

## Speak

Read a random message aloud on the default audio output:

```bash
npm run speak                          # uses QUOTE_CHANNEL_ID
npm run speak -- 123456789012345678    # or pass a channel ID
```

Synthesis uses the `msedge-tts` Node library (Microsoft Edge neural voices), so no
system TTS engine is needed — but it does require network access at runtime.
Playback goes through `play-sound`, which picks the first available player from
`mpv`, `ffplay`, `mplayer`, `afplay`, or `cvlc`.

Set `TTS_VOICE` in `.env` to any Edge voice `ShortName` (`en-US-GuyNeural`,
`en-GB-SoniaNeural`, …). Silence on success; errors go to stderr with exit `1`.

## Configuration

| Variable                | Default | Description                                          |
| ----------------------- | ------- | ---------------------------------------------------- |
| `DISCORD_TOKEN`         | —       | Bot token (required)                                 |
| `DISCORD_CLIENT_ID`     | —       | Application ID (required)                            |
| `GUILD_ID`              | —       | Register commands to one guild instead of globally   |
| `QUOTE_CHANNEL_ID`      | —       | Default channel for `/quote`                         |
| `QUOTE_HISTORY_LIMIT`   | `500`   | How many recent messages to consider (max 5000)      |
| `QUOTE_EXCLUDE_BOTS`    | `true`  | Skip messages sent by bots                           |
| `QUOTE_MIN_AGE_SECONDS` | `0`     | Skip messages newer than this (0 disables)           |

## Docker

```bash
docker compose up -d --build
```

## Scripts

| Script              | Description                        |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Run with hot reload                |
| `npm run build`     | Compile TypeScript to `dist/`      |
| `npm start`         | Run the compiled bot               |
| `npm run deploy`    | Register slash commands            |
| `npm run quote`     | Print a random message as JSON     |
| `npm run typecheck` | Type check without emitting output |
