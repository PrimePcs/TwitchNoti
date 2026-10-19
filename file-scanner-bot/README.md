# Discord VirusTotal file scanner

This is a separate Discord bot. It scans attachments posted in channels whose parent category matches `WATCH_CATEGORY_ID`, then posts a result in the same channel or `RESULT_CHANNEL_ID`.

## Discord setup

Create a new bot application and invite it to the server with `View Channels`, `Send Messages`, `Embed Links`, and `Read Message History`. Enable the **Message Content Intent** in the Developer Portal. The bot does not need Administrator or Manage Roles.

Copy `.env.example` to `.env`, fill in the values, and deploy this folder as its own Railway service. `WATCH_CATEGORY_ID` is the category's Discord ID (enable Developer Mode, right-click the category, and choose Copy Category ID).

VirusTotal's public file API uploads submitted files to its dataset. Use VirusTotal Private Scanning instead if the files are confidential; that requires the appropriate VirusTotal plan.
