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
npm run dev      # run the bot (watch mode)
```

The bot is the long-lived process: it keeps the Discord gateway connection and,
at the same time, a small HTTP server for `npm run speak` (see below). Keep it
running and use the CLI scripts against it instead of booting a new process per
request.

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

Read a random message aloud on the machine that runs the bot:

```bash
npm run dev                            # start the bot first, in another terminal
npm run speak                          # uses QUOTE_CHANNEL_ID
npm run speak -- 123456789012345678    # or pass a channel ID
```

`npm run speak` does no work of its own — it is a thin client. It POSTs to the
HTTP server the running bot exposes on `127.0.0.1:$SPEAK_PORT` (`7433` by
default), waits until that clip has finished playing, and prints the spoken text.
Synthesis, playback and the Discord calls all happen once, in the bot process, so
repeated invocations skip the startup cost. Requests are queued, so a second
`npm run speak` plays after the first instead of talking over it.

If no bot is running it exits `1` with a "No quote bot running on …" message on
stderr.

The same endpoint works from anything that speaks HTTP:

```bash
curl http://127.0.0.1:7433/health
curl -X POST http://127.0.0.1:7433/speak -H 'content-type: application/json' -d '{}'
curl -X POST http://127.0.0.1:7433/speak -H 'content-type: application/json' -d '{"channelId":"123456789012345678"}'
```

The server only listens on loopback, and is not exposed outside the host (in
Docker: only inside the container).

Synthesis uses the `msedge-tts` Node library (Microsoft Edge neural voices), so no
system TTS engine is needed — but it does require network access at runtime.
Playback goes through `play-sound`, which picks the first available player from
`mpv`, `ffplay`, `mplayer`, `afplay`, `mpg123`, `cvlc`, or `cmdmp3`. On Windows,
where none of those are usually installed, it falls back to a built-in
PowerShell `MediaPlayer` call, so no extra software is needed there either.

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
| `TTS_VOICE`             | `en-US-GuyNeural` | Edge voice used by `npm run speak`        |
| `SPEAK_PORT`            | `7433`  | Port for the bot's local speak server               |

## Docker

```bash
docker compose up -d --build
docker compose exec quote-bot node dist/speak.js   # speak from inside the container
```

The speak server binds to loopback, so it is only reachable inside the container
— use `docker compose exec` rather than publishing the port.

## Scripts

| Script              | Description                        |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Run with hot reload                |
| `npm run build`     | Compile TypeScript to `dist/`      |
| `npm start`         | Run the compiled bot               |
| `npm run deploy`    | Register slash commands            |
| `npm run quote`     | Print a random message as JSON     |
| `npm run speak`     | Speak a random message via the running bot |
| `npm run typecheck` | Type check without emitting output |
