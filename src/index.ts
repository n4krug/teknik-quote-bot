import { Client, GatewayIntentBits, Interaction } from 'discord.js';
import { config } from './config';
import { commands } from './commands';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error handling /${interaction.commandName}:`, error);
    const message = 'Something went wrong handling that command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => undefined);
    } else {
      await interaction
        .reply({ content: message, ephemeral: true })
        .catch(() => undefined);
    }
  }
});

client.login(config.token);
