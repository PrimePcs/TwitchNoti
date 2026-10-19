import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";

const required = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_GUILD_ID",
  "WATCH_CATEGORY_ID",
  "VIRUSTOTAL_API_KEY",
];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`);
}

const guildId = process.env.DISCORD_GUILD_ID.trim();
const categoryId = process.env.WATCH_CATEGORY_ID.trim();
const vtKey = process.env.VIRUSTOTAL_API_KEY.trim();
const resultChannelId = process.env.RESULT_CHANNEL_ID?.trim() || null;
const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 32) * 1024 * 1024;
if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > 32 * 1024 * 1024) {
  throw new Error("MAX_FILE_SIZE_MB must be between 0 and 32");
}
let lastRequestAt = 0;
async function vtFetch(url, options = {}) {
  const delay = Math.max(0, 16000 - (Date.now() - lastRequestAt));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  lastRequestAt = Date.now();
  return fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

function apiHeaders() {
  return { "x-apikey": vtKey };
}

async function uploadToVirusTotal(name, bytes) {
  const form = new FormData();
  form.append("file", new Blob([bytes]), name);
  let response;
  if (bytes.byteLength <= 32 * 1024 * 1024) {
    response = await vtFetch("https://www.virustotal.com/api/v3/files", {
      method: "POST", headers: apiHeaders(), body: form,
    });
  } else {
    const urlResponse = await fetch("https://www.virustotal.com/api/v3/files/upload_url", { headers: apiHeaders() });
    if (!urlResponse.ok) throw new Error(`VirusTotal upload URL failed (${urlResponse.status})`);
    const uploadUrl = (await urlResponse.json()).data;
    response = await fetch(uploadUrl, { method: "POST", headers: apiHeaders(), body: form });
  }
  if (!response.ok) throw new Error(`VirusTotal upload failed (${response.status})`);
  return (await response.json()).data.id;
}

async function waitForAnalysis(id) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const response = await vtFetch(`https://www.virustotal.com/api/v3/analyses/${encodeURIComponent(id)}`, { headers: apiHeaders() });
    if (!response.ok) throw new Error(`VirusTotal analysis lookup failed (${response.status})`);
    const data = (await response.json()).data;
    if (data.attributes.status === "completed") return data.attributes.stats || {};
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("VirusTotal scan timed out");
}

function resultText(stats) {
  const malicious = Number(stats.malicious || 0) + Number(stats.suspicious || 0);
  if (malicious > 0) return `⚠️ **Detection: ${malicious} engine(s) flagged this file.**`;
  return "✅ **No detections were reported by the scan.**";
}

async function scanAttachment(message, attachment) {
  if (attachment.size > maxBytes) {
    await message.reply(`❌ \`${attachment.name}\` is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
    return;
  }
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Discord download failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("File exceeds scan size limit");
  const analysisId = await uploadToVirusTotal(attachment.name, bytes);
  const stats = await waitForAnalysis(analysisId);
  const output = new EmbedBuilder()
    .setTitle("VirusTotal file scan")
    .setDescription(`${resultText(stats)}\nFile: **${attachment.name}**\nUploaded by: <@${message.author.id}>`)
    .addFields(
      { name: "Malicious", value: String(stats.malicious || 0), inline: true },
      { name: "Suspicious", value: String(stats.suspicious || 0), inline: true },
      { name: "Undetected", value: String(stats.undetected || 0), inline: true },
    )
    .setColor((stats.malicious || stats.suspicious) ? 0xed4245 : 0x57f287)
    .setFooter({ text: "No detections does not guarantee safety. Public VirusTotal submissions are shared." });
  const destination = resultChannelId ? await client.channels.fetch(resultChannelId) : message.channel;
  await destination.send({ embeds: [output], allowedMentions: { parse: [] } });
}

let scanQueue = Promise.resolve();
let queued = 0;
client.once("clientReady", () => console.log(`File scanner online as ${client.user.tag}; watching category ${categoryId}`));
client.on("messageCreate", async (message) => {
  if (message.author.bot || message.guildId !== guildId || message.channel.parentId !== categoryId || !message.attachments.size) return;
  for (const attachment of message.attachments.values()) {
    if (queued >= 20) {
      await message.reply({ content: "⚠️ Scanner queue is full. Please try again later.", allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
      break;
    }
    queued += 1;
    scanQueue = scanQueue.then(async () => {
      try { await scanAttachment(message, attachment); }
      catch (error) { console.error("Scan failed:", error.message); await message.reply({ content: "⚠️ I could not finish scanning an attachment. Treat it as unscanned.", allowedMentions: { parse: [], repliedUser: false } }).catch(() => {}); }
      finally { queued -= 1; }
    });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN.trim()).catch(error => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
