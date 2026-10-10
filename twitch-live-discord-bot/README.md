# Twitch Live Discord Bot

A small, zero-dependency Node.js bot that checks selected Twitch channels and posts a rich Discord alert when one goes live.

It remembers the Twitch stream ID after posting, so restarting the bot will not announce the same stream twice. A new stream gets a new Twitch stream ID and will be announced normally.

## What you need

- Node.js 20.6 or newer
- A Discord server where you can add a bot
- A Twitch account with two-factor authentication enabled

## 1. Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and choose **New Application**.
2. Open **Bot**, choose **Reset Token**, and copy the token. Keep it secret.
3. Open **OAuth2 > URL Generator** (or **Installation** in the newer portal UI).
4. Select the `bot` scope and these permissions: **View Channels**, **Send Messages**, and **Embed Links**.
5. Open the generated URL and add the bot to your server.
6. In Discord, enable **User Settings > Advanced > Developer Mode**. Right-click the text channel that should receive alerts and choose **Copy Channel ID**.

The bot does not connect to Discord's Gateway, so it does not need privileged intents.

## 2. Create the Twitch application

1. Open the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and register an application.
2. Use `http://localhost` as the OAuth redirect URL. This bot uses server-to-server authentication, so that URL is not visited.
3. Choose **Application Integration** as the category.
4. Copy the **Client ID**, create a **Client Secret**, and keep the secret private.

## 3. Configure it

Copy `.env.example` to a new file named `.env` in this folder. Fill in:

```dotenv
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=123456789012345678
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_CHANNELS=channel_one,channel_two
```

Use Twitch login names in `TWITCH_CHANNELS`, not profile URLs. Names are comma-separated and are not case-sensitive.

To ping a particular Discord role, enable Developer Mode, right-click the role, copy its ID, and add:

```dotenv
DISCORD_ROLE_ID=123456789012345678
```

Make sure the bot is allowed to mention that role. If `DISCORD_ROLE_ID` is omitted, the bot posts the alert without pinging a role.

You can also customize the alert text:

```dotenv
ALERT_MESSAGE=🔴 **{name} is live playing {game}!** {url}
```

Supported placeholders are `{name}`, `{login}`, `{url}`, `{title}`, and `{game}`.

## 4. Run it

No package installation is required.

```powershell
node --env-file=.env src/index.js
```

Or, if `npm` is installed, load `.env` into your terminal first and run:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
npm start
```

Leave the process running. It checks Twitch every 60 seconds by default. Press `Ctrl+C` to stop it cleanly.

Run the included tests with:

```powershell
node --test
```

## Hosting

This is a continuously running process. You can run it on a PC that stays on, a VPS, a container host, or a Node-compatible app host. Copy the whole folder, configure the same environment variables, and run `node src/index.js`. If your host supplies environment variables through a dashboard, you do not need to upload `.env`.

Keep the `.state` directory on persistent storage. It contains only the last announced stream IDs and prevents duplicate messages after restarts.

## Deploy on Railway (your PC can stay off)

Railway can run this as a continuously running service. The included `Dockerfile` is detected automatically.

1. Create a private GitHub repository and upload this project's files. Do **not** upload `.env`.
2. Sign in at [Railway](https://railway.com/), create a project, choose **Deploy from GitHub repo**, and select your repository.
3. Open the new service's **Variables** page and add each setting separately:

   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CHANNEL_ID`
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_CHANNELS`
   - `DISCORD_ROLE_ID` (optional)
   - `ALERT_MESSAGE` (optional)

4. In the service, add a volume mounted at `/data`.
5. Add one more variable: `STATE_FILE=/data/live-streams.json`.
6. Deploy the staged changes. In **Deployments > View Logs**, look for `Watching 1 Twitch channel(s)`.

Railway becomes the computer running the bot. You can close your browser and turn off your PC after the deployment is active.

## Troubleshooting

- **Discord 401:** the bot token is wrong or was reset. Update `DISCORD_BOT_TOKEN`.
- **Discord 403:** the bot is not in the server or lacks View Channel, Send Messages, or Embed Links in the target channel.
- **Discord 404:** `DISCORD_CHANNEL_ID` is wrong or belongs to a server the bot cannot access.
- **Twitch 400/401:** verify the Twitch Client ID and Client Secret. Creating a new secret invalidates the old one.
- **No alert:** confirm `TWITCH_CHANNELS` contains the login from the channel URL, then check the terminal log.

## Security

Never commit or share `.env`. Discord bot tokens and Twitch client secrets should be treated like passwords. If one leaks, regenerate it immediately.
