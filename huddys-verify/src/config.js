const SNOWFLAKE = /^\d{17,20}$/;

export function loadConfig(env = process.env) {
  const required = ["DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  const guildId = env.DISCORD_GUILD_ID.trim();
  const roleId = env.VERIFIED_ROLE_ID?.trim() || null;
  const channelId = env.VERIFY_CHANNEL_ID?.trim() || null;
  for (const [name, value] of [["DISCORD_GUILD_ID", guildId], ["VERIFIED_ROLE_ID", roleId], ["VERIFY_CHANNEL_ID", channelId]]) {
    if (value && !SNOWFLAKE.test(value)) throw new Error(`${name} must be a Discord ID.`);
  }
  return { token: env.DISCORD_BOT_TOKEN.trim(), guildId, roleId, channelId };
}
