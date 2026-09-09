import 'dotenv/config';
import { config } from './config';
import { deployCommands } from './commands';

async function main(): Promise<void> {
  const count = await deployCommands(config.token, config.clientId, config.guildId);
  const target = config.guildId ? `guild ${config.guildId}` : 'all guilds (global)';
  console.log(`Registered ${count} command(s) for ${target}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
