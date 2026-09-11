import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { playFile } from './audio';
import { config } from './config';
import type { QuoteMessage } from './quote-service';
import { fetchQuote } from './rest-quote';
import { synthesize } from './tts';

export interface SpokenQuote {
  text: string;
  dateLine: string | null;
  author: string;
  channelId: string;
  url: string;
}

interface PreparedQuote {
  quote: QuoteMessage;
  text: string;
  dateLine: string | null;
  audio: Buffer;
}

export interface RenderedQuote extends SpokenQuote {
  audio: Buffer;
}

let queue: Promise<unknown> = Promise.resolve();
let prepared: Promise<PreparedQuote> | undefined;
let preparedChannelId: string | undefined;

export function spokenText(quote: QuoteMessage): { text: string; dateLine: string | null } {
  if (!quote.content.includes('-')) return { text: quote.content, dateLine: null };

  const pieces = quote.content.split('-');
  const dateLine = `Den ${quote.createdAt.getDay()}:e ${quote.createdAt.toLocaleString('sv-se', { month: 'long' })} ${quote.createdAt.getFullYear()}`;
  const text = pieces[pieces.length - 1] + ' sa. ' + pieces.slice(0, -1) + '.';

  return { text, dateLine };
}

async function prepare(channelId: string): Promise<PreparedQuote> {
  const quote = await fetchQuote(channelId);

  if (!quote) {
    throw new Error('No quotable messages found in that channel.');
  }

  const { text, dateLine } = spokenText(quote);

  return { quote, text, dateLine, audio: await synthesize(text) };
}

export function primeQuote(channelId = config.quoteChannelId): void {
  if (!channelId || prepared) return;

  const pending = prepare(channelId);
  prepared = pending;
  preparedChannelId = channelId;

  void pending.catch(() => {
    if (prepared === pending) {
      prepared = undefined;
      preparedChannelId = undefined;
    }
  });
}

function toSpoken(item: PreparedQuote): SpokenQuote {
  return {
    text: item.text,
    dateLine: item.dateLine,
    author: item.quote.author.displayName,
    channelId: item.quote.channelId,
    url: item.quote.url,
  };
}

async function playAudio(audio: Buffer): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), 'quote-bot-'));

  try {
    const audioFilePath = path.join(dir, 'audio.mp3');
    await writeFile(audioFilePath, audio);
    await playFile(audioFilePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function takeQuote(channelId: string): Promise<RenderedQuote> {
  const pending = channelId === preparedChannelId ? prepared : undefined;

  if (pending) {
    prepared = undefined;
    preparedChannelId = undefined;
  }

  try {
    const item = pending ? await pending : await prepare(channelId);
    return { ...toSpoken(item), audio: item.audio };
  } finally {
    primeQuote();
  }
}

async function runSpeak(channelId: string): Promise<SpokenQuote> {
  const { audio, ...spoken } = await takeQuote(channelId);

  if (spoken.dateLine) console.log(spoken.dateLine);
  console.log(spoken.text);

  await playAudio(audio);
  return spoken;
}

export function speakQuote(channelId: string): Promise<SpokenQuote> {
  const spoken = queue.then(() => runSpeak(channelId));
  queue = spoken.catch(() => undefined);
  return spoken;
}
