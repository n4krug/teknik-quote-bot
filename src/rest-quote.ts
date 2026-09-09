import { REST, Routes } from 'discord.js';
import type { APIMessage } from 'discord-api-types/v10';
import { config } from './config';
import { messageUrl, selectQuote, type QuoteMessage } from './quote-service';

const PAGE_SIZE = 100;

type RawMessage = APIMessage & {
  guild_id?: string;
  member?: { nick?: string | null };
};

async function fetchMessages(
  rest: REST,
  channelId: string,
  limit: number,
): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  let before: string | undefined;

  while (messages.length < limit) {
    const query = new URLSearchParams({
      limit: String(Math.min(PAGE_SIZE, limit - messages.length)),
    });
    if (before) query.set('before', before);

    const batch = (await rest.get(Routes.channelMessages(channelId), {
      query,
    })) as RawMessage[];

    if (batch.length === 0) break;

    messages.push(...batch);
    before = batch[batch.length - 1].id;
    if (batch.length < PAGE_SIZE) break;
  }

  return messages;
}

function toQuoteMessage(
  raw: RawMessage,
  rest: REST,
  channelId: string,
): QuoteMessage {
  const guildId = raw.guild_id ?? null;
  const image = raw.attachments.find(
    (attachment) => attachment.content_type?.startsWith('image/') ?? false,
  );

  return {
    id: raw.id,
    type: raw.type,
    content: raw.content,
    author: {
      id: raw.author.id,
      username: raw.author.username,
      displayName: raw.member?.nick ?? raw.author.global_name ?? raw.author.username,
      avatarURL: raw.author.avatar
        ? rest.cdn.avatar(raw.author.id, raw.author.avatar)
        : null,
      bot: raw.author.bot ?? false,
    },
    channelId,
    guildId,
    createdAt: new Date(raw.timestamp),
    url: messageUrl(guildId, channelId, raw.id),
    attachments: raw.attachments.map((attachment) => attachment.url),
    imageUrl: image?.url ?? null,
  };
}

export async function fetchQuote(channelId: string): Promise<QuoteMessage | null> {
  if (!channelId) {
    throw new Error('No channel given. Pass a channel ID argument or set QUOTE_CHANNEL_ID in .env');
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  const raw = await fetchMessages(rest, channelId, config.historyLimit);

  return selectQuote(raw.map((message) => toQuoteMessage(message, rest, channelId)));
}
