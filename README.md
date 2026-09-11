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

## Web page

The bot serves a small page with a **Speak a quote** button on
<http://127.0.0.1:7433> (or whatever `SPEAK_PORT` is). Clicking it fetches the
pre-rendered quote as MP3 and plays it in the browser, showing the quote text and
author. Nothing is played on the host's speakers unless you use `npm run speak`.

It is served from the bot itself, so it is same-origin and needs no CORS headers —
which also means only the machine running the bot can open it.

Set `WEB_PASSPHRASE` in `.env` to put it behind a passphrase: the page then shows a
passphrase field instead of the button, and `/speak` rejects requests without a
matching `x-passphrase` header (so the quotes are not reachable by just calling the
endpoint). The passphrase is kept in `sessionStorage` for the tab and compared
server-side with a timing-safe hash compare. It is a simple gate, not real
security — put it behind HTTPS (a tunnel or reverse proxy) if you expose it. When
`WEB_PASSPHRASE` is empty the page and endpoints stay open, and the bot logs a
warning at startup.

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

Add `?mode=audio` to get the MP3 itself instead of playing it on the host (this is
what the web page uses) — the raw quote text (mentions replaced with nicknames)
and the author come back in `x-quote-content` and `x-quote-author` headers,
URI-encoded. The synthesised wording is not sent; `POST /speak` without `mode`
returns it as `text` in the JSON body:

```bash
curl -X POST 'http://127.0.0.1:7433/speak?mode=audio' -H 'content-type: application/json' -d '{}' -o quote.mp3
```

The server only listens on loopback, and is not exposed outside the host (in
Docker: only inside the container).

Synthesis uses [`edge-tts-universal`](https://github.com/travisvn/edge-tts-universal)
(Microsoft Edge's neural voices — no API key, no cost), so quality is the neural
`sv-SE` voices rather than a robotic formant synth. The trade-off is that it
needs network access at runtime.

The bot **pre-renders the next quote while idle**: when it starts, and again after
every `/speak`, it fetches a quote and synthesizes it in the background. A
`speak` request for the default channel then just plays what is already in memory,
so audio starts in a fraction of a second instead of waiting for the Discord
history fetch (~1.7 s) and synthesis (~0.5 s). Passing an explicit channel ID
skips the cache and synthesizes on demand.

User mentions (`<@123…>`) are replaced with that member's server nickname before
synthesis, so they are read as names instead of IDs. Nicknames come from the
Discord API (guild member, falling back to display name then username) and are
cached for the life of the process. Unresolvable mentions are dropped.

Set `TTS_VOICE` to any Edge voice `ShortName` (`sv-SE-MattiasNeural`,
`sv-SE-SofieNeural`, `en-GB-SoniaNeural`, …) and `TTS_RATE` to a rate adjustment
(`+10%`, `-20%`, …). Output is MP3, played on Windows through
`System.Windows.Media.MediaPlayer` and elsewhere via `play-sound` (`mpv`,
`ffplay`, `mplayer`, `afplay`, `mpg123`, `cvlc`, `cmdmp3`).

Silence on success; errors go to stderr with exit `1`.

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
| `TTS_VOICE`             | `sv-SE-MattiasNeural` | Edge voice used by `npm run speak` |
| `TTS_RATE`              | `+0%`   | Speaking rate adjustment for `TTS_VOICE`   |
| `SPEAK_PORT`            | `7433`  | Port for the bot's local speak server               |
| `WEB_PASSPHRASE`        | —       | Passphrase required by the web page (empty = open)  |

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
