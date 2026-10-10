import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { CommunityStateStore } from "./community-state.js";
import { chooseWinners, parseDuration } from "./community-utils.js";

const MAX_TIMER_DELAY = 2_000_000_000;

function middlemanButtons(status) {
  const closed = status === "completed" || status === "cancelled";
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_accept")
      .setLabel(status === "pending" ? "Accept terms" : "Terms accepted")
      .setStyle(ButtonStyle.Success)
      .setDisabled(status !== "pending"),
    new ButtonBuilder()
      .setCustomId("mm_claim")
      .setLabel(status === "claimed" ? "Claimed" : "Claim ticket")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(status !== "accepted"),
    new ButtonBuilder()
      .setCustomId("mm_complete")
      .setLabel("Complete trade")
      .setStyle(ButtonStyle.Success)
      .setDisabled(status !== "claimed"),
    new ButtonBuilder()
      .setCustomId("mm_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed),
  );
}

function ticketEmbed(ticket) {
  const statusLabels = {
    pending: "Waiting for the other trader",
    accepted: "Waiting for a middleman",
    claimed: "Middleman assigned",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return new EmbedBuilder()
    .setColor(ticket.status === "completed" ? 0x57f287 : ticket.status === "cancelled" ? 0xed4245 : 0xfee75c)
    .setTitle("Middleman trade")
    .addFields(
      { name: "Trader 1", value: `<@${ticket.requesterId}>`, inline: true },
      { name: "Trader 2", value: `<@${ticket.traderId}>`, inline: true },
      { name: "Status", value: statusLabels[ticket.status], inline: false },
      { name: "Items / service", value: ticket.items.slice(0, 1_024) },
      { name: "Payment", value: ticket.payment.slice(0, 1_024) },
      ...(ticket.claimedBy ? [{ name: "Middleman", value: `<@${ticket.claimedBy}>` }] : []),
    )
    .setFooter({ text: "Never share passwords, login codes, tokens, or payment-card details." })
    .setTimestamp(new Date(ticket.createdAt));
}

function giveawayEmbed(giveaway, ended = false, winners = []) {
  return new EmbedBuilder()
    .setColor(ended ? 0x57f287 : 0x5865f2)
    .setTitle(`🎉 ${giveaway.prize}`)
    .setDescription(
      ended
        ? winners.length
          ? `Winner${winners.length === 1 ? "" : "s"}: ${winners.map((id) => `<@${id}>`).join(", ")}`
          : "No valid entries were received."
        : `Click **Enter giveaway** below.\nEnds <t:${Math.floor(giveaway.endAt / 1_000)}:R>.`,
    )
    .addFields(
      { name: "Winners", value: String(giveaway.winnerCount), inline: true },
      { name: "Entries", value: String(giveaway.entries.length), inline: true },
      ...(giveaway.requiredRoleId
        ? [{ name: "Required role", value: `<@&${giveaway.requiredRoleId}>`, inline: true }]
        : []),
    )
    .setFooter({ text: `Hosted by ${giveaway.hostTag}` })
    .setTimestamp(new Date(giveaway.endAt));
}

const commands = [
  new SlashCommandBuilder()
    .setName("middleman")
    .setDescription("Open a private middleman trade ticket")
    .addSubcommand((sub) =>
      sub
        .setName("request")
        .setDescription("Request a middleman for a trade")
        .addUserOption((option) => option.setName("trader").setDescription("The other trader").setRequired(true))
        .addStringOption((option) => option.setName("items").setDescription("Items or service being traded").setMaxLength(1_000).setRequired(true))
        .addStringOption((option) => option.setName("payment").setDescription("What the other side is paying").setMaxLength(1_000).setRequired(true)),
    ),
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage server giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a giveaway")
        .addStringOption((option) => option.setName("prize").setDescription("The prize").setMaxLength(256).setRequired(true))
        .addStringOption((option) => option.setName("duration").setDescription("Examples: 10m, 2h, 3d").setRequired(true))
        .addIntegerOption((option) => option.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(10).setRequired(true))
        .addChannelOption((option) => option.setName("channel").setDescription("Where to post it").addChannelTypes(ChannelType.GuildText))
        .addRoleOption((option) => option.setName("required_role").setDescription("Role required to enter")),
    )
    .addSubcommand((sub) =>
      sub.setName("reroll").setDescription("Reroll an ended giveaway").addStringOption((option) => option.setName("message_id").setDescription("Giveaway message ID").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName("cancel").setDescription("Cancel an active giveaway").addStringOption((option) => option.setName("message_id").setDescription("Giveaway message ID").setRequired(true)),
    ),
].map((command) => command.toJSON());

export async function startCommunityBot(config, stateFile, log = console.log) {
  if (!config.discordGuildId) {
    log("Community commands disabled (DISCORD_GUILD_ID is not set)." );
    return null;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const store = new CommunityStateStore(stateFile);
  await store.load();
  const timers = new Map();

  const finishGiveaway = async (messageId) => {
    const giveaway = store.data.giveaways[messageId];
    if (!giveaway || giveaway.status !== "active") return;
    if (Date.now() < giveaway.endAt) {
      const timer = setTimeout(() => finishGiveaway(messageId), Math.min(MAX_TIMER_DELAY, giveaway.endAt - Date.now()));
      timers.set(messageId, timer);
      return;
    }
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    const message = channel?.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
    const winners = chooseWinners(giveaway.entries, giveaway.winnerCount);
    giveaway.status = "ended";
    giveaway.winners = winners;
    await store.save();
    if (message) {
      await message.edit({ embeds: [giveawayEmbed(giveaway, true, winners)], components: [] });
      if (winners.length) await channel.send(`🎉 Congratulations ${winners.map((id) => `<@${id}>`).join(", ")}!`);
    }
  };

  client.once("ready", async () => {
    const guild = await client.guilds.fetch(config.discordGuildId);
    await guild.commands.set(commands);
    for (const [messageId, giveaway] of Object.entries(store.data.giveaways)) {
      if (giveaway.status === "active") void finishGiveaway(messageId);
    }
    log(`Community bot online as ${client.user.tag}; slash commands registered in ${guild.name}.`);
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "middleman") {
        if (!config.middlemanRoleId) return interaction.reply({ content: "Middleman tickets are not configured yet.", ephemeral: true });
        const trader = interaction.options.getUser("trader", true);
        if (trader.bot || trader.id === interaction.user.id) return interaction.reply({ content: "Choose another human member as the trader.", ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const ticket = {
          requesterId: interaction.user.id,
          traderId: trader.id,
          items: interaction.options.getString("items", true),
          payment: interaction.options.getString("payment", true),
          status: "pending",
          claimedBy: null,
          createdAt: Date.now(),
        };
        const channel = await interaction.guild.channels.create({
          name: `trade-${interaction.user.username}-${trader.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
          type: ChannelType.GuildText,
          parent: config.ticketCategoryId || undefined,
          topic: `Middleman trade: ${interaction.user.tag} and ${trader.tag}`,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
            { id: trader.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
            { id: config.middlemanRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] },
          ],
        });
        const message = await channel.send({
          content: `<@${ticket.requesterId}> <@${ticket.traderId}> <@&${config.middlemanRoleId}>`,
          embeds: [ticketEmbed(ticket)],
          components: [middlemanButtons(ticket.status)],
          allowedMentions: { users: [ticket.requesterId, ticket.traderId], roles: [config.middlemanRoleId] },
        });
        ticket.messageId = message.id;
        store.data.tickets[channel.id] = ticket;
        await store.save();
        return interaction.editReply(`Private trade ticket created: ${channel}`);
      }

      if (interaction.isChatInputCommand() && interaction.commandName === "giveaway") {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "start") {
          const duration = parseDuration(interaction.options.getString("duration", true));
          if (!duration) return interaction.reply({ content: "Use a duration from 10s to 30d, such as `30m`, `2h`, or `3d`.", ephemeral: true });
          const channel = interaction.options.getChannel("channel") || interaction.channel;
          const giveaway = {
            channelId: channel.id,
            guildId: interaction.guildId,
            hostId: interaction.user.id,
            hostTag: interaction.user.tag,
            prize: interaction.options.getString("prize", true),
            winnerCount: interaction.options.getInteger("winners", true),
            requiredRoleId: interaction.options.getRole("required_role")?.id || null,
            endAt: Date.now() + duration,
            entries: [],
            status: "active",
          };
          const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("gw_enter").setLabel("Enter giveaway").setEmoji("🎉").setStyle(ButtonStyle.Primary));
          const message = await channel.send({ embeds: [giveawayEmbed(giveaway)], components: [row] });
          store.data.giveaways[message.id] = giveaway;
          await store.save();
          void finishGiveaway(message.id);
          return interaction.reply({ content: `Giveaway created: ${message.url}`, ephemeral: true });
        }

        const messageId = interaction.options.getString("message_id", true);
        const giveaway = store.data.giveaways[messageId];
        if (!giveaway) return interaction.reply({ content: "I could not find that giveaway ID.", ephemeral: true });
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        const message = channel?.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (subcommand === "cancel") {
          if (giveaway.status !== "active") return interaction.reply({ content: "That giveaway is not active.", ephemeral: true });
          giveaway.status = "cancelled";
          clearTimeout(timers.get(messageId));
          await store.save();
          if (message) await message.edit({ content: "Giveaway cancelled.", components: [] });
          return interaction.reply({ content: "Giveaway cancelled.", ephemeral: true });
        }
        if (giveaway.status !== "ended") return interaction.reply({ content: "Only ended giveaways can be rerolled.", ephemeral: true });
        const winners = chooseWinners(giveaway.entries, giveaway.winnerCount);
        giveaway.winners = winners;
        await store.save();
        if (message) await message.edit({ embeds: [giveawayEmbed(giveaway, true, winners)] });
        return interaction.reply({ content: winners.length ? `New winner${winners.length === 1 ? "" : "s"}: ${winners.map((id) => `<@${id}>`).join(", ")}` : "No valid entries to reroll.", allowedMentions: { users: winners } });
      }

      if (interaction.isButton() && interaction.customId === "gw_enter") {
        const giveaway = store.data.giveaways[interaction.message.id];
        if (!giveaway || giveaway.status !== "active") return interaction.reply({ content: "This giveaway has ended.", ephemeral: true });
        if (giveaway.requiredRoleId && !interaction.member.roles.cache.has(giveaway.requiredRoleId)) return interaction.reply({ content: `You need the <@&${giveaway.requiredRoleId}> role to enter.`, ephemeral: true });
        const index = giveaway.entries.indexOf(interaction.user.id);
        const joining = index === -1;
        if (joining) giveaway.entries.push(interaction.user.id);
        else giveaway.entries.splice(index, 1);
        await store.save();
        await interaction.update({ embeds: [giveawayEmbed(giveaway)], components: interaction.message.components });
        return interaction.followUp({ content: joining ? "You entered the giveaway!" : "You left the giveaway.", ephemeral: true });
      }

      if (interaction.isButton() && interaction.customId.startsWith("mm_")) {
        const ticket = store.data.tickets[interaction.channelId];
        if (!ticket) return interaction.reply({ content: "This ticket is no longer tracked.", ephemeral: true });
        const isMiddleman = interaction.member.roles.cache.has(config.middlemanRoleId);
        const isParticipant = [ticket.requesterId, ticket.traderId].includes(interaction.user.id);
        if (interaction.customId === "mm_accept") {
          if (interaction.user.id !== ticket.traderId) return interaction.reply({ content: "Only the invited trader can accept these terms.", ephemeral: true });
          ticket.status = "accepted";
        } else if (interaction.customId === "mm_claim") {
          if (!isMiddleman) return interaction.reply({ content: "Only an approved middleman can claim this ticket.", ephemeral: true });
          ticket.status = "claimed";
          ticket.claimedBy = interaction.user.id;
        } else if (interaction.customId === "mm_complete") {
          if (ticket.claimedBy !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: "Only the assigned middleman or a manager can complete this trade.", ephemeral: true });
          ticket.status = "completed";
        } else if (interaction.customId === "mm_cancel") {
          if (!isParticipant && !isMiddleman) return interaction.reply({ content: "Only a trader or middleman can cancel this ticket.", ephemeral: true });
          ticket.status = "cancelled";
        }
        await store.save();
        await interaction.update({ embeds: [ticketEmbed(ticket)], components: [middlemanButtons(ticket.status)] });
        if (["completed", "cancelled"].includes(ticket.status)) {
          await interaction.channel.permissionOverwrites.edit(ticket.requesterId, { SendMessages: false });
          await interaction.channel.permissionOverwrites.edit(ticket.traderId, { SendMessages: false });
          if (config.tradeLogChannelId) {
            const logChannel = await client.channels.fetch(config.tradeLogChannelId).catch(() => null);
            if (logChannel?.isTextBased()) await logChannel.send({ embeds: [ticketEmbed(ticket)] });
          }
        }
      }
    } catch (error) {
      console.error("Community interaction failed:", error);
      const response = { content: "Something went wrong. A server manager can check the bot logs.", ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
      else await interaction.reply(response).catch(() => {});
    }
  });

  await client.login(config.discordBotToken);
  return client;
}

