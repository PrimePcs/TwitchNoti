import { Client, Events, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { loadConfig } from "./config.js";
import { buildVerifyPanel, canonicalName, canManageRole, resolveVerifiedRole, VERIFY_BUTTON_ID } from "./verify.js";

const config = loadConfig();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const setupCommand = new SlashCommandBuilder()
  .setName("verify-setup")
  .setDescription("Post the Huddy's Verify button")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) => option.setName("channel").setDescription("Channel for the verification panel"))
  .toJSON();

client.once(Events.ClientReady, async (readyClient) => {
  const guild = await readyClient.guilds.fetch(config.guildId);
  await guild.commands.set([setupCommand]);
  console.log(`Huddy's Verify online as ${readyClient.user.tag} in ${guild.name}.`);
  await guild.channels.fetch();
  const channel = config.channelId
    ? await guild.channels.fetch(config.channelId).catch(() => null)
    : guild.channels.cache.find((item) => item.isTextBased() && canonicalName(item.name) === "verify");
  if (channel?.isTextBased()) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    const alreadyPosted = recent?.some((message) => message.author.id === readyClient.user.id && message.components.some((row) => row.components.some((button) => button.customId === VERIFY_BUTTON_ID)));
    if (!alreadyPosted) await channel.send(buildVerifyPanel());
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "verify-setup") {
      const channel = interaction.options.getChannel("channel") || interaction.channel;
      if (!channel?.isTextBased()) return interaction.reply({ content: "Choose a text channel.", ephemeral: true });
      await channel.send(buildVerifyPanel());
      return interaction.reply({ content: `Verification panel posted in ${channel}.`, ephemeral: true });
    }
    if (!interaction.isButton() || interaction.customId !== VERIFY_BUTTON_ID) return;
    await interaction.deferReply({ ephemeral: true });
    const role = await resolveVerifiedRole(interaction.guild, config.roleId);
    if (!role) return interaction.editReply("The Verified role is not configured. Ask an administrator to set it up.");
    if (!canManageRole(interaction.guild, role)) return interaction.editReply("I cannot assign the Verified role. Move my bot role above it and enable Manage Roles.");
    if (interaction.member.roles.cache.has(role.id)) return interaction.editReply("You are already verified ✅");
    await interaction.member.roles.add(role, "Member verified with Huddy's Verify");
    return interaction.editReply("You are verified! Welcome to the server ✅");
  } catch (error) {
    console.error("Verification failed:", error);
    const message = { content: "Verification failed. Please ask a staff member for help.", ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(message).catch(() => {});
    else await interaction.reply(message).catch(() => {});
  }
});

client.login(config.token).catch((error) => {
  console.error("Huddy's Verify could not start:", error.message);
  process.exitCode = 1;
});
