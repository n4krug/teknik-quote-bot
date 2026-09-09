import { ChatInputCommandInteraction, Collection, REST, Routes } from 'discord.js';
import * as quote from './quote';

export interface Command {
  data: { name: string; toJSON: () => unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>();

for (const command of [quote] as unknown as Command[]) {
  commands.set(command.data.name, command);
}

export function commandData(): unknown[] {
  return commands.map((command) => command.data.toJSON());
}

export async function deployCommands(
  token: string,
  clientId: string,
  guildId?: string,
): Promise<number> {
  const rest = new REST({ version: '10' }).setToken(token);
  const body = commandData();

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body });
  return body.length;
}
