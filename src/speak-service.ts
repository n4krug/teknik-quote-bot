import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { playFile } from './audio';
import { config } from './config';
import type { QuoteMessage } from './quote-service';
import { fetchQuote } from './rest-quote';

const MP3_KBPS = 48;

export interface SpokenQuote {
  text: string;
  dateLine: string | null;
  author: string;
  channelId: string;
  url: string;
}

export function spokenText(quote: QuoteMessage): { text: string; dateLine: string | null } {
  if (!quote.content.includes('-')) return { text: quote.content, dateLine: null };

  const pieces = quote.content.split('-');
  const dateLine = `Den ${quote.createdAt.getDay()}:e ${quote.createdAt.toLocaleString('sv-se', { month: 'long' })} ${quote.createdAt.getFullYear()}`;
  const text = pieces[pieces.length - 1] + ' sa. ' + pieces.slice(0, -1) + '.';

  return { text, dateLine };
}

async function synthesizeAndPlay(channelId: string): Promise<SpokenQuote> {
  const quote = await fetchQuote(channelId);

  if (!quote) {
    throw new Error('No quotable messages found in that channel.');
  }

  const { text, dateLine } = spokenText(quote);

  if (dateLine) console.log(dateLine);
  console.log(text);

  const dir = await mkdtemp(path.join(tmpdir(), 'quote-bot-'));
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(config.ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(dir, text);
    const { size } = await stat(audioFilePath);
    await playFile(audioFilePath, (size * 8) / MP3_KBPS + 1000);
  } finally {
    tts.close();
    await rm(dir, { recursive: true, force: true });
  }

  return {
    text,
    dateLine,
    author: quote.author.displayName,
    channelId: quote.channelId,
    url: quote.url,
  };
}

let queue: Promise<unknown> = Promise.resolve();

export function speakQuote(channelId: string): Promise<SpokenQuote> {
  const spoken = queue.then(() => synthesizeAndPlay(channelId));
  queue = spoken.catch(() => undefined);
  return spoken;
}
