import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config';
import {
  fetchHistory,
  isGuildTextChannel,
  selectQuote,
  toQuoteMessage,
} from '../quote-service';

function truncate(text: string, max = 4096): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function buildEmbed(quote: ReturnType<typeof toQuoteMessage>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: quote.author.displayName,
      iconURL: quote.author.avatarURL ?? undefined,
      url: quote.url,
    })
    .setDescription(truncate(quote.content))
    .setTimestamp(quote.createdAt)
    .addFields({ name: 'Source', value: `[Jump to message](${quote.url})` });

  if (quote.imageUrl) embed.setImage(quote.imageUrl);

  return embed;
}

export const data = new SlashCommandBuilder()
  .setName('quote')
  .setDescription('Post a random message from a channel')
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Channel to pull from (defaults to the configured channel)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const mentioned = interaction.options.getChannel('channel');
  const fallback = config.quoteChannelId
    ? interaction.client.channels.cache.get(config.quoteChannelId)
    : undefined;

  const resolved = isGuildTextChannel(mentioned)
    ? mentioned
    : isGuildTextChannel(fallback)
      ? fallback
      : null;

  if (!resolved) {
    await interaction.reply({
      content: config.quoteChannelId
        ? 'Could not resolve a text channel to quote from.'
        : 'No channel given and no default channel is configured.',
      ephemeral: true,
    });
    return;
  }

  const channel = resolved;
  const me = channel.guild?.members.me ?? interaction.guild?.members.me;
  const permissions = me ? channel.permissionsFor(me) : null;

  if (
    permissions &&
    !permissions.has([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.ReadMessageHistory,
    ])
  ) {
    await interaction.reply({
      content: `I need permission to view ${channel} and read its message history.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const messages = await fetchHistory(channel, config.historyLimit);
  const quote = selectQuote(messages.map(toQuoteMessage));

  if (!quote) {
    await interaction.editReply('No quotable messages found in that channel.');
    return;
  }

  await interaction.editReply({ embeds: [buildEmbed(quote)] });
}
