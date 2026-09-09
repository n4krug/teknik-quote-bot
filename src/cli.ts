import 'dotenv/config';
import { config } from './config';
import { fetchQuote } from './rest-quote';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const channelId = process.argv[2]?.trim() || config.quoteChannelId;

  if (!channelId) {
    fail('No channel given. Pass a channel ID argument or set QUOTE_CHANNEL_ID in .env');
  }

  try {
    const quote = await fetchQuote(channelId);

    if (!quote) {
      fail('No quotable messages found in that channel.');
    }

    process.stdout.write(`${JSON.stringify(quote, null, 2)}\n`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

void main();
