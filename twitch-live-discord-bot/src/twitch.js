const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const STREAMS_URL = "https://api.twitch.tv/helix/streams";
const REQUEST_TIMEOUT_MS = 15_000;

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function responseError(response, label) {
  const body = await response.text();
  return new Error(`${label} failed (${response.status}): ${body || response.statusText}`);
}

export class TwitchClient {
  constructor({ clientId, clientSecret, fetchImpl = fetch }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetch = fetchImpl;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  async authenticate() {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
    });

    const response = await this.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw await responseError(response, "Twitch authentication");

    const data = await response.json();
    this.accessToken = data.access_token;
    // Refresh five minutes early. Twitch currently returns expires_in in seconds.
    this.tokenExpiresAt = Date.now() + Math.max(60, data.expires_in - 300) * 1_000;
  }

  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
  }

  async requestStreams(logins, allowAuthRetry = true) {
    await this.ensureAuthenticated();

    const url = new URL(STREAMS_URL);
    for (const login of logins) url.searchParams.append("user_login", login);

    const response = await this.fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Client-Id": this.clientId,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 401 && allowAuthRetry) {
      this.accessToken = null;
      return this.requestStreams(logins, false);
    }
    if (!response.ok) throw await responseError(response, "Twitch stream lookup");

    const data = await response.json();
    return data.data;
  }

  async getLiveStreams(logins) {
    const results = await Promise.all(
      chunks(logins, 100).map((batch) => this.requestStreams(batch)),
    );
    return results.flat();
  }
}

export { chunks };
