import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loads the required Discord configuration", () => {
  const config = loadConfig({ DISCORD_BOT_TOKEN: "token", DISCORD_GUILD_ID: "1558623476691243072" });
  assert.equal(config.guildId, "1558623476691243072");
  assert.equal(config.roleId, null);
});

test("rejects malformed Discord IDs", () => {
  assert.throws(() => loadConfig({ DISCORD_BOT_TOKEN: "token", DISCORD_GUILD_ID: "nope" }), /Discord ID/);
});
