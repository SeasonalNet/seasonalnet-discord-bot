import { SlashCommandBuilder } from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import { agentReplyEmbed } from '../../ui/embeds.js';
import { askAgent, type AgentTarget } from './service.js';

const askCommand: ChatCommand = {
  name: 'ask',
  scope: 'agents.use',
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the SeasonalNet agent layer a question.')
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('Which workflow context to use.')
        .setRequired(true)
        .addChoices(
          { name: 'seasonalnet', value: 'seasonalnet' },
          { name: 'homelab', value: 'homelab' },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('What do you want to ask?')
        .setRequired(true)
        .setMaxLength(1500),
    ),
  async execute(context: AppContext, interaction) {
    const target = interaction.options.getString('target', true) as AgentTarget;
    const question = interaction.options.getString('question', true).trim();

    if (question.length > context.settings.agents.max_question_length) {
      throw new Error(`Question exceeds max length of ${context.settings.agents.max_question_length} characters.`);
    }

    await interaction.deferReply();

    const result = await askAgent(context, interaction, target, question);

    await interaction.editReply({
      embeds: [
        agentReplyEmbed(target, {
          reply:      result.reply,
          usedTools:  result.used_tools,
          model:      result.model,
          toolRounds: result.tool_rounds,
        }),
      ],
    });
  },
};

export const agentCommands: ChatCommand[] = [askCommand];
