import { randomInt } from 'node:crypto';
import { GuildTextBasedChannel, Message, MessageType } from 'discord.js';
import { config } from './config';

const PAGE_SIZE = 100;
const QUOTABLE_TYPES: ReadonlySet<number> = new Set([MessageType.Default, MessageType.Reply]);

export interface QuoteMessage {
  id: string;
  type: number;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarURL: string | null;
    bot: boolean;
  };
  channelId: string;
  guildId: string | null;
  createdAt: Date;
  url: string;
  attachments: string[];
  imageUrl: string | null;
  mentionNames: Record<string, string>;
}

export function isGuildTextChannel(channel: unknown): channel is GuildTextBasedChannel {
  if (channel === null || typeof channel !== 'object') return false;
  const candidate = channel as GuildTextBasedChannel;
  return !candidate.isDMBased() && typeof candidate.messages?.fetch === 'function';
}

export function messageUrl(
  guildId: string | null,
  channelId: string,
  messageId: string,
): string {
  return `https://discord.com/channels/${guildId ?? '@me'}/${channelId}/${messageId}`;
}

export async function fetchHistory(
  channel: GuildTextBasedChannel,
  limit: number,
): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;

  while (messages.length < limit) {
    const batch = await channel.messages.fetch({
      limit: Math.min(PAGE_SIZE, limit - messages.length),
      before,
    });
    if (batch.size === 0) break;

    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < PAGE_SIZE) break;
  }

  return messages;
}

function mentionNames(message: Message): Record<string, string> {
  const names: Record<string, string> = {};

  for (const [id, user] of message.mentions.users) {
    const member = message.mentions.members?.get(id) ?? message.guild?.members.cache.get(id);
    names[id] = member?.displayName ?? user.globalName ?? user.username;
  }

  return names;
}

export function toQuoteMessage(message: Message): QuoteMessage {
  const image = message.attachments.find(
    (attachment) => attachment.contentType?.startsWith('image/') ?? false,
  );

  return {
    id: message.id,
    type: message.type,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName ?? message.author.displayName,
      avatarURL: message.author.displayAvatarURL(),
      bot: message.author.bot,
    },
    channelId: message.channelId,
    guildId: message.guildId,
    createdAt: message.createdAt,
    url: message.url,
    attachments: message.attachments.map((attachment) => attachment.url),
    imageUrl: image?.url ?? null,
    mentionNames: mentionNames(message),
  };
}

function isQuotable(message: QuoteMessage, cutoff: number | null): boolean {
  if (!QUOTABLE_TYPES.has(message.type)) return false;
  if (config.excludeBots && message.author.bot) return false;
  if (message.content.trim().length === 0) return false;
  if (cutoff !== null && message.createdAt.getTime() > cutoff) return false;
  return true;
}

export function selectQuote(messages: QuoteMessage[]): QuoteMessage | null {
  const cutoff =
    config.minAgeSeconds > 0 ? Date.now() - config.minAgeSeconds * 1000 : null;
  const candidates = messages.filter((message) => isQuotable(message, cutoff));

  if (candidates.length === 0) return null;
  return candidates[randomInt(candidates.length)];
}
