import type { Server } from 'node:http';
import { Client, GatewayIntentBits, Interaction } from 'discord.js';
import { commands } from './commands';
import { config } from './config';
import { serverUrl, startSpeakServer } from './speak-server';
import { primeQuote } from './speak-service';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let speakServer: Server | undefined;

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

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down.`);
  speakServer?.close();
  client.destroy();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

startSpeakServer()
  .then((server) => {
    speakServer = server;
    console.log(`Speak server listening on ${serverUrl(server)} — open it in a browser for a speak button`);

    if (!config.webPassphrase) {
      console.log('Warning: no WEB_PASSPHRASE set, the speak page is open to anyone who can reach it.');
    }

    primeQuote();
    return client.login(config.token);
  })
  .catch((error: unknown) => {
    console.error('Failed to start:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
