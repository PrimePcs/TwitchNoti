import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from "discord.js";

export const VERIFY_BUTTON_ID = "huddys_verify";

export function buildVerifyPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Verify to enter")
    .setDescription("Click the button below to verify yourself and unlock the server.")
    .setFooter({ text: "Huddy's Verify" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(VERIFY_BUTTON_ID).setLabel("Verify").setEmoji("✅").setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row] };
}

export async function resolveVerifiedRole(guild, configuredRoleId) {
  if (configuredRoleId) return guild.roles.fetch(configuredRoleId).catch(() => null);
  await guild.roles.fetch();
  return guild.roles.cache.find((role) => /^✅?\s*verified$/i.test(role.name.trim())) || null;
}

export function canManageRole(guild, role) {
  const botMember = guild.members.me;
  return Boolean(botMember && botMember.permissions.has(PermissionFlagsBits.ManageRoles) && role.position < botMember.roles.highest.position);
}
