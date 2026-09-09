import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { config } from './config';
import { speakQuote } from './speak-service';

const MAX_BODY_BYTES = 4096;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large.');
    chunks.push(buffer);
  }

  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function channelIdFrom(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as { channelId?: unknown }).channelId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const route = new URL(req.url ?? '/', `http://${config.speakHost}:${config.speakPort}`);

  try {
    if (req.method === 'GET' && route.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', voice: config.ttsVoice });
      return;
    }

    if (req.method === 'POST' && route.pathname === '/speak') {
      const channelId = channelIdFrom(await readJsonBody(req)) ?? config.quoteChannelId;

      if (!channelId) {
        sendJson(res, 400, { error: 'No channel given. Pass a channelId or set QUOTE_CHANNEL_ID.' });
        return;
      }

      sendJson(res, 200, { ok: true, ...(await speakQuote(channelId)) });
      return;
    }

    sendJson(res, 404, { error: `No route for ${req.method} ${route.pathname}` });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

export function startSpeakServer(): Promise<Server> {
  const server = createServer((req, res) => {
    void handle(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.speakPort, config.speakHost, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

export function serverUrl(server: Server): string {
  const address = server.address() as AddressInfo | null;
  return `http://${address?.address ?? config.speakHost}:${address?.port ?? config.speakPort}`;
}
