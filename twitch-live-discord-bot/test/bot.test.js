import assert from "node:assert/strict";
import test from "node:test";
import { parseChannelLogins, parsePollInterval } from "../src/config.js";
import { buildMessage, fillTemplate } from "../src/discord.js";
import { chunks } from "../src/twitch.js";

const stream = {
  id: "987",
  user_login: "some_streamer",
  user_name: "Some_Streamer",
  game_name: "Just Chatting",
  title: "A test stream",
  viewer_count: 42,
  started_at: "2026-10-10T20:00:00Z",
  thumbnail_url: "https://example.test/{width}x{height}.jpg",
};

test("channel parser normalizes and removes duplicates", () => {
  assert.deepEqual(parseChannelLogins(" @Foo,bar,foo "), ["foo", "bar"]);
});

test("channel parser rejects URLs and invalid names", () => {
  assert.throws(() => parseChannelLogins("https://twitch.tv/foo"), /Invalid Twitch/);
});

test("poll interval has a safe lower bound", () => {
  assert.equal(parsePollInterval(undefined), 60_000);
  assert.equal(parsePollInterval("30"), 30_000);
  assert.throws(() => parsePollInterval("10"), /at least 30/);
});

test("stream requests can be split into Twitch's 100-login batches", () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("alert template replaces supported placeholders", () => {
  assert.equal(
    fillTemplate("{name} plays {game}: {url}", stream),
    "Some_Streamer plays Just Chatting: https://twitch.tv/some_streamer",
  );
});

test("Discord payload limits mentions to the configured role", () => {
  const payload = buildMessage(stream, {
    roleId: "123456789012345678",
    alertMessage: "{name} is live!",
  });

  assert.match(payload.content, /^<@&123456789012345678>/);
  assert.deepEqual(payload.allowed_mentions, { roles: ["123456789012345678"] });
  assert.equal(payload.embeds[0].url, "https://twitch.tv/some_streamer");
  assert.match(payload.embeds[0].image.url, /1280x720\.jpg\?t=\d+$/);
});

test("alert payload does not parse mentions outside the configured role", () => {
  const payload = buildMessage(stream, { roleId: null, alertMessage: "{name} is live!" });
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});
