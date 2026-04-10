import type { Settings } from '../core/config.js';
import type { BotModule, ChatCommand } from '../core/types.js';
import { utilityCommands } from './utility/commands.js';
import { moderationCommands } from './moderation/commands.js';
import { loadAgentCommands } from './agents/commands.js';
import { welcomeModule } from './welcome/index.js';

export function loadModules(settings: Settings): BotModule[] {
  return [
    {
      name: 'utility',
      commands: utilityCommands,
    },
    {
      name: 'moderation',
      commands: moderationCommands,
    },
    {
      name: 'agents',
      commands: loadAgentCommands(settings),
    },
    welcomeModule,
  ];
}

export function loadCommands(settings: Settings): ChatCommand[] {
  return loadModules(settings).flatMap((module) => [...(module.commands ?? [])]);
}
