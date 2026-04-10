import type { Settings } from '../core/config.js';
import type { ChatCommand } from '../core/types.js';
import { utilityCommands } from './utility/commands.js';
import { moderationCommands } from './moderation/commands.js';
import { loadAgentCommands } from './agents/commands.js';

export function loadCommands(settings: Settings): ChatCommand[] {
  return [
    ...utilityCommands,
    ...moderationCommands,
    ...loadAgentCommands(settings),
  ];
}
