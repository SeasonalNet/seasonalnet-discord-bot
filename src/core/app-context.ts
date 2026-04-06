import type { Client } from 'discord.js';

import type { Settings } from './config.js';
import type { Logger } from './logger.js';
import type { Database } from '../storage/database.js';
import type { SeasonalAgentClient } from '../integrations/seasonal-agent.js';

export interface AppContext {
  readonly client: Client;
  readonly settings: Settings;
  readonly logger: Logger;
  readonly database: Database;
  readonly seasonalAgent: SeasonalAgentClient;
}
