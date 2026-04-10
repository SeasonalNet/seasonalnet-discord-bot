import type { ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { AppContext } from './app-context.js';

export interface CommandResult {
  content?: string;
}

export interface SlashCommandDataLike {
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export interface ChatCommand {
  readonly name: string;
  readonly scope: string;
  readonly guildOnly?: boolean;
  readonly data: SlashCommandDataLike;
  execute(context: AppContext, interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface BotModule {
  readonly name: string;
  readonly commands?: readonly ChatCommand[];
  register?(context: AppContext): void;
}

export type CommandJson = RESTPostAPIChatInputApplicationCommandsJSONBody;
