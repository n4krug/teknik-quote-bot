import { REST, Routes } from 'discord.js';

const MENTION_PATTERN = /<@!?(\d{17,20})>/g;

const guildByChannel = new Map<string, string | null>();
const nameByMember = new Map<string, string | null>();

export function mentionIds(content: string): string[] {
  const ids = new Set<string>();

  for (const match of content.matchAll(MENTION_PATTERN)) {
    ids.add(match[1]);
  }

  return [...ids];
}

async function guildIdFor(rest: REST, channelId: string): Promise<string | null> {
  const cached = guildByChannel.get(channelId);
  if (cached !== undefined) return cached;

  let guildId: string | null = null;

  try {
    const channel = (await rest.get(Routes.channel(channelId))) as { guild_id?: string };
    guildId = channel.guild_id ?? null;
  } catch {
    guildId = null;
  }

  guildByChannel.set(channelId, guildId);
  return guildId;
}

async function fetchName(
  rest: REST,
  guildId: string | null,
  userId: string,
): Promise<string | null> {
  const key = `${guildId ?? '@me'}:${userId}`;
  const cached = nameByMember.get(key);
  if (cached !== undefined) return cached;

  let name: string | null = null;

  if (guildId) {
    try {
      const member = (await rest.get(Routes.guildMember(guildId, userId))) as {
        nick?: string | null;
        user?: { global_name?: string | null; username?: string };
      };
      name = member.nick ?? member.user?.global_name ?? member.user?.username ?? null;
    } catch {
      name = null;
    }
  }

  if (!name) {
    try {
      const user = (await rest.get(Routes.user(userId))) as {
        global_name?: string | null;
        username?: string;
      };
      name = user.global_name ?? user.username ?? null;
    } catch {
      name = null;
    }
  }

  nameByMember.set(key, name);
  return name;
}

export async function mentionNames(
  rest: REST,
  channelId: string,
  content: string,
): Promise<Record<string, string>> {
  const ids = mentionIds(content);
  if (ids.length === 0) return {};

  const guildId = await guildIdFor(rest, channelId);
  const resolved = await Promise.all(
    ids.map(async (id) => [id, await fetchName(rest, guildId, id)] as const),
  );

  const names: Record<string, string> = {};
  for (const [id, name] of resolved) {
    if (name) names[id] = name;
  }

  return names;
}
