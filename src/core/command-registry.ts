import type { ChatCommand } from './types.js';

export class CommandRegistry {
  private readonly commands = new Map<string, ChatCommand>();

  register(command: ChatCommand): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Duplicate command registered: ${command.name}`);
    }
    this.commands.set(command.name, command);
  }

  get(name: string): ChatCommand | undefined {
    return this.commands.get(name);
  }

  all(): ChatCommand[] {
    return [...this.commands.values()];
  }
}
