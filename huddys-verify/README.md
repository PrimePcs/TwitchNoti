# Huddy's Verify

A separate Discord bot that posts a green **Verify** button and assigns the server's existing Verified role.

## Environment variables

- `DISCORD_BOT_TOKEN` – token for the Huddy's Verify application
- `DISCORD_GUILD_ID` – server ID (`1558623476691243072`)
- `VERIFIED_ROLE_ID` – existing Verified role ID (optional if the role is named `Verified` or `✅ Verified`)
- `VERIFY_CHANNEL_ID` – channel where the bot should automatically post its panel (optional)

The bot needs **Manage Roles**, **View Channels**, **Send Messages**, and **Embed Links**. Its bot role must be placed above the Verified role.

Administrators can also run `/verify-setup` to post the panel in any text channel.
