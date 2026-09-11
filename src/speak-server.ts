import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { config } from './config';
import { speakQuote, takeQuote, type RenderedQuote } from './speak-service';

const MAX_BODY_BYTES = 4096;
const PAGE_FILE = path.join(__dirname, '..', 'public', 'index.html');

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendAudio(res: ServerResponse, quote: RenderedQuote): void {
  res.writeHead(200, {
    'content-type': 'audio/mpeg',
    'content-length': quote.audio.length,
    'x-quote-content': encodeURIComponent(quote.content),
    'x-quote-author': encodeURIComponent(quote.author),
    'cache-control': 'no-store',
  });
  res.end(quote.audio);
}

async function sendPage(res: ServerResponse): Promise<void> {
  const html = await readFile(PAGE_FILE);
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': html.length,
  });
  res.end(html);
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

function passphraseFrom(req: IncomingMessage): string | undefined {
  const value = req.headers['x-passphrase'];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function isAuthorized(req: IncomingMessage): boolean {
  const expected = config.webPassphrase;
  if (!expected) return true;

  const candidate = passphraseFrom(req);
  if (!candidate) return false;

  return timingSafeEqual(
    createHash('sha256').update(candidate).digest(),
    createHash('sha256').update(expected).digest(),
  );
}

function channelIdFrom(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as { channelId?: unknown }).channelId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function resolveChannel(req: IncomingMessage): Promise<string | undefined> {
  return channelIdFrom(await readJsonBody(req)) ?? config.quoteChannelId;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const route = new URL(req.url ?? '/', `http://${config.speakHost}:${config.speakPort}`);

  try {
    if (req.method === 'GET' && (route.pathname === '/' || route.pathname === '/index.html')) {
      await sendPage(res);
      return;
    }

    if (req.method === 'GET' && route.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', voice: config.ttsVoice });
      return;
    }

    if (req.method === 'GET' && route.pathname === '/config') {
      sendJson(res, 200, { passphraseRequired: Boolean(config.webPassphrase) });
      return;
    }

    if (req.method === 'POST' && route.pathname === '/unlock') {
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: 'Wrong passphrase.' });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && route.pathname === '/speak') {
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: config.webPassphrase ? 'Wrong passphrase.' : 'Passphrase required.' });
        return;
      }

      const channelId = await resolveChannel(req);

      if (!channelId) {
        sendJson(res, 400, { error: 'No channel given. Pass a channelId or set QUOTE_CHANNEL_ID.' });
        return;
      }

      if (route.searchParams.get('mode') === 'audio') {
        sendAudio(res, await takeQuote(channelId));
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
