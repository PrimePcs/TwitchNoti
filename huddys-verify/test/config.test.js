import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { canonicalName } from "../src/verify.js";

test("loads the required Discord configuration", () => {
  const config = loadConfig({ DISCORD_BOT_TOKEN: "token", DISCORD_GUILD_ID: "1558623476691243072" });
  assert.equal(config.guildId, "1558623476691243072");
  assert.equal(config.roleId, null);
});

test("rejects malformed Discord IDs", () => {
  assert.throws(() => loadConfig({ DISCORD_BOT_TOKEN: "token", DISCORD_GUILD_ID: "nope" }), /Discord ID/);
});

test("normalizes styled verification names", () => {
  assert.equal(canonicalName("✅・Ｖｅｒｉｆｙ"), "verify");
  assert.equal(canonicalName("✅ 𝖁𝖊𝖗𝖎𝖋𝖎𝖊𝖉"), "verified");
});
