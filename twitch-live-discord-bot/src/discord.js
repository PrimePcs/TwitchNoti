const API_BASE = "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 15_000;

function fillTemplate(template, stream) {
  const replacements = {
    name: stream.user_name,
    login: stream.user_login,
    url: `https://twitch.tv/${stream.user_login}`,
    title: stream.title || "Untitled stream",
    game: stream.game_name || "No category",
  };

  return template.replace(/\{(name|login|url|title|game)\}/g, (_, key) => replacements[key]);
}

function buildMessage(stream, { roleId, alertMessage }) {
  const streamUrl = `https://twitch.tv/${stream.user_login}`;
  const thumbnail = stream.thumbnail_url
    .replace("{width}", "1280")
    .replace("{height}", "720");
  const roleMention = roleId ? `<@&${roleId}> ` : "";

  return {
    content: `${roleMention}${fillTemplate(alertMessage, stream)}`.slice(0, 2_000),
    embeds: [
      {
        title: (stream.title || `${stream.user_name} is live`).slice(0, 256),
        url: streamUrl,
        color: 0x9146ff,
        author: {
          name: stream.user_name,
          url: streamUrl,
        },
        fields: [
          { name: "Category", value: stream.game_name || "No category", inline: true },
          { name: "Viewers", value: String(stream.viewer_count), inline: true },
        ],
        image: { url: `${thumbnail}?t=${Date.now()}` },
        timestamp: stream.started_at,
        footer: { text: "Live on Twitch" },
      },
    ],
    allowed_mentions: roleId ? { roles: [roleId] } : { parse: [] },
  };
}

async function errorFromResponse(response) {
  const body = await response.text();
  return new Error(`Discord message failed (${response.status}): ${body || response.statusText}`);
}

export class DiscordClient {
  constructor({ botToken, channelId, roleId, alertMessage, fetchImpl = fetch }) {
    this.botToken = botToken;
    this.channelId = channelId;
    this.roleId = roleId;
    this.alertMessage = alertMessage;
    this.fetch = fetchImpl;
  }

  async sendLiveAlert(stream, retryCount = 0) {
    const response = await this.fetch(`${API_BASE}/channels/${this.channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${this.botToken}`,
        "Content-Type": "application/json",
        "User-Agent": "TwitchLiveDiscordBot (https://github.com/, 1.0.0)",
      },
      body: JSON.stringify(
        buildMessage(stream, {
          roleId: this.roleId,
          alertMessage: this.alertMessage,
        }),
      ),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429 && retryCount < 2) {
      const data = await response.json();
      const delayMs = Math.max(1_000, Math.ceil(Number(data.retry_after || 1) * 1_000));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.sendLiveAlert(stream, retryCount + 1);
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `Discord rejected the alert channel (${this.channelId}). ` +
          "Make sure this bot is in the server and has View Channel, Send Messages, and Embed Links in that channel.",
        );
      }
      throw await errorFromResponse(response);
    }
    return response.json();
  }
}

export { buildMessage, fillTemplate };
