import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function intEnv(name: string, fallback: number, max?: number): number {
  const raw = optionalEnv(name);
  if (raw === undefined) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`${name} must be at most ${max}, got: ${parsed}`);
  }
  return parsed;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = optionalEnv(name);
  if (raw === undefined) return fallback;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  throw new Error(`${name} must be true or false, got: ${raw}`);
}

const HISTORY_LIMIT_MAX = 5000;
const PORT_MAX = 65535;

export const config = {
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('DISCORD_CLIENT_ID'),
  guildId: optionalEnv('GUILD_ID'),
  quoteChannelId: optionalEnv('QUOTE_CHANNEL_ID'),
  ttsVoice: optionalEnv('TTS_VOICE') ?? 'sv-SE-MattiasNeural',
  ttsRate: optionalEnv('TTS_RATE') ?? '+0%',
  historyLimit: intEnv('QUOTE_HISTORY_LIMIT', 500, HISTORY_LIMIT_MAX),
  excludeBots: boolEnv('QUOTE_EXCLUDE_BOTS', true),
  minAgeSeconds: intEnv('QUOTE_MIN_AGE_SECONDS', 0),
  speakHost: '127.0.0.1',
  speakPort: intEnv('SPEAK_PORT', 7433, PORT_MAX),
  webPassphrase: optionalEnv('WEB_PASSPHRASE'),
} as const;

export const speakBaseUrl = `http://${config.speakHost}:${config.speakPort}`;
