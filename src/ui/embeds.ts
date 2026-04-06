import { EmbedBuilder } from 'discord.js';

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp(new Date());
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp(new Date());
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp(new Date());
}
