import 'dotenv/config';
import { config, speakBaseUrl } from './config';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function isConnectionRefused(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === 'ECONNREFUSED' || candidate.cause?.code === 'ECONNREFUSED';
}

interface SpeakResponse {
  text?: string;
  dateLine?: string | null;
  error?: string;
}

async function main(): Promise<void> {
  const channelId = process.argv[2]?.trim() || config.quoteChannelId;

  let response: Response;
  try {
    response = await fetch(`${speakBaseUrl}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(channelId ? { channelId } : {}),
    });
  } catch (error) {
    if (isConnectionRefused(error)) {
      fail(`No quote bot running on ${speakBaseUrl}. Start it with "npm run dev" (or "npm start") first.`);
    }
    fail(error instanceof Error ? error.message : String(error));
  }

  const payload = (await response.json().catch(() => null)) as SpeakResponse | null;

  if (!response.ok || !payload) {
    fail(payload?.error ?? `Speak request failed with status ${response.status}.`);
  }

  if (payload.dateLine) process.stdout.write(`${payload.dateLine}\n`);
  process.stdout.write(`${payload.text ?? ''}\n`);
}

void main();
