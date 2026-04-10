import { SlashCommandBuilder } from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import type { Settings } from '../../core/config.js';
import { agentReplyEmbed } from '../../ui/embeds.js';
import { askAgent, listEnabledAgentTargets, resolveAgentTarget, type AgentTargetId } from './service.js';

function buildAskCommand(settings: Settings): ChatCommand {
  const targets = listEnabledAgentTargets(settings);
  if (targets.length === 0) {
    throw new Error('At least one enabled agent target must be configured.');
  }

  if (targets.length > 25) {
    throw new Error('Discord supports at most 25 slash command choices for the ask target option.');
  }

  return {
    name: 'ask',
    scope: 'agents.use',
    data: new SlashCommandBuilder()
      .setName('ask')
      .setDescription('Ask the SeasonalNet agent layer a question.')
      .addStringOption((option) => {
        const configured = option
          .setName('target')
          .setDescription('Which workflow context to use.')
          .setRequired(true);

        for (const target of targets) {
          configured.addChoices({ name: target.display_name, value: target.id });
        }

        return configured;
      })
      .addStringOption((option) =>
        option
          .setName('question')
          .setDescription('What do you want to ask?')
          .setRequired(true)
          .setMaxLength(1500),
      ),
    async execute(context: AppContext, interaction) {
      const targetId = interaction.options.getString('target', true) as AgentTargetId;
      const target = resolveAgentTarget(context.settings, targetId);
      const question = interaction.options.getString('question', true).trim();

      if (question.length > context.settings.agents.max_question_length) {
        throw new Error(`Question exceeds max length of ${context.settings.agents.max_question_length} characters.`);
      }

      await interaction.deferReply();

      const result = await askAgent(context, interaction, target.id, question);

      await interaction.editReply({
        embeds: [
          agentReplyEmbed(target.display_name, {
            reply: result.reply,
            usedTools: result.used_tools,
            model: result.model,
            toolRounds: result.tool_rounds,
          }),
        ],
      });
    },
  };
}

export function loadAgentCommands(settings: Settings): ChatCommand[] {
  return [buildAskCommand(settings)];
}
