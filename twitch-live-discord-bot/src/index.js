import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { DiscordClient } from "./discord.js";
import { StateStore } from "./state.js";
import { TwitchClient } from "./twitch.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  const config = loadConfig();
  const twitch = new TwitchClient({
    clientId: config.twitchClientId,
    clientSecret: config.twitchClientSecret,
  });
  const discord = new DiscordClient({
    botToken: config.discordBotToken,
    channelId: config.discordChannelId,
    roleId: config.discordRoleId,
    alertMessage: config.alertMessage,
  });
  const stateFile = process.env.STATE_FILE?.trim() ||
    path.join(projectRoot, ".state", "live-streams.json");
  const state = new StateStore(stateFile);
  await state.load();

  log(
    `Watching ${config.twitchChannels.length} Twitch channel(s); checking every ${
      config.pollIntervalMs / 1_000
    } seconds.`,
  );

  let stopping = false;
  const stop = (signal) => {
    log(`${signal} received; stopping after the current check.`);
    stopping = true;
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  while (!stopping) {
    const startedAt = Date.now();

    try {
      const streams = await twitch.getLiveStreams(config.twitchChannels);

      for (const stream of streams) {
        const login = stream.user_login.toLowerCase();
        if (state.hasNotified(login, stream.id)) continue;

        await discord.sendLiveAlert(stream);
        await state.markNotified(login, stream.id);
        log(`Announced ${stream.user_name}: ${stream.title || "Untitled stream"}`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Check failed:`, error);
    }

    const remainingMs = Math.max(0, config.pollIntervalMs - (Date.now() - startedAt));
    if (stopping) break;
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }

  log("Stopped.");
}

main().catch((error) => {
  console.error("Bot could not start:", error.message);
  process.exitCode = 1;
});
