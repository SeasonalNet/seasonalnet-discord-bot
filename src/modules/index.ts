import type { ChatCommand } from '../core/types.js';
import { utilityCommands } from './utility/commands.js';
import { moderationCommands } from './moderation/commands.js';
import { agentCommands } from './agents/commands.js';

export function loadCommands(): ChatCommand[] {
  return [
    ...utilityCommands,
    ...moderationCommands,
    ...agentCommands,
  ];
}
