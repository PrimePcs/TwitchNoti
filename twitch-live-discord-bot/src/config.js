const REQUIRED_KEYS = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_CHANNEL_ID",
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "TWITCH_CHANNELS",
];

function requireValues(env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function parseChannelLogins(value) {
  const channels = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
    ),
  ];

  const invalid = channels.filter((login) => !/^[a-z0-9_]{1,25}$/.test(login));
  if (invalid.length > 0) {
    throw new Error(`Invalid Twitch login name(s): ${invalid.join(", ")}`);
  }

  if (channels.length === 0) {
    throw new Error("TWITCH_CHANNELS must contain at least one Twitch login name.");
  }

  return channels;
}

function parsePollInterval(value) {
  if (!value) return 60_000;

  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 30) {
    throw new Error("POLL_INTERVAL_SECONDS must be a whole number of at least 30.");
  }

  return seconds * 1_000;
}

export function loadConfig(env = process.env) {
  requireValues(env);

  const discordChannelId = env.DISCORD_CHANNEL_ID.trim();
  const discordRoleId = env.DISCORD_ROLE_ID?.trim() || null;

  if (!/^\d{17,20}$/.test(discordChannelId)) {
    throw new Error("DISCORD_CHANNEL_ID must be a Discord snowflake ID (17-20 digits).");
  }
  if (discordRoleId && !/^\d{17,20}$/.test(discordRoleId)) {
    throw new Error("DISCORD_ROLE_ID must be a Discord snowflake ID (17-20 digits).");
  }

  return {
    discordBotToken: env.DISCORD_BOT_TOKEN.trim(),
    discordChannelId,
    discordRoleId,
    twitchClientId: env.TWITCH_CLIENT_ID.trim(),
    twitchClientSecret: env.TWITCH_CLIENT_SECRET.trim(),
    twitchChannels: parseChannelLogins(env.TWITCH_CHANNELS),
    pollIntervalMs: parsePollInterval(env.POLL_INTERVAL_SECONDS),
    alertMessage:
      env.ALERT_MESSAGE?.trim() || "🔴 **{name} is live on Twitch!**",
  };
}

export { parseChannelLogins, parsePollInterval };
