import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { config } from './config';
import { fetchQuote } from './rest-quote';
import { playFile } from './audio';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const channelId = process.argv[2]?.trim() || config.quoteChannelId;

  if (!channelId) {
    fail('No channel given. Pass a channel ID argument or set QUOTE_CHANNEL_ID in .env');
  }

  let quote;
  try {
    quote = await fetchQuote(channelId);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (!quote) {
    fail('No quotable messages found in that channel.');
  }

  let quoteText = quote.content

  if (quoteText.includes("-")) {
    const quotepieces = quoteText.split("-")

    const date = `Den ${quote.createdAt.getDay()}:e ${quote.createdAt.toLocaleString('sv-se', {month: "long"})} ${quote.createdAt.getFullYear()}`

    console.log(date)

    quoteText = quotepieces[quotepieces.length-1] + " sa. " + quotepieces.slice(0,-1) + "."
  }
  console.log(quoteText)

  const dir = await mkdtemp(path.join(tmpdir(), 'quote-bot-'));
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(config.ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(dir, quoteText);
    tts.close();
    await playFile(audioFilePath);
  } finally {
    tts.close();
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
