export const pendingText = "⏳ **SCAN PENDING — THIS FILE MAY BE UNSAFE.**\nDo not download or open it until scanning finishes. If the result is uncertain, staff review is needed.";

export function verdict(stats = {}) {
  const malicious = Number(stats.malicious || 0);
  const suspicious = Number(stats.suspicious || 0);
  const checked = Number(stats.harmless || 0) + Number(stats.undetected || 0);
  const failed = Number(stats.timeout || 0) + Number(stats['confirmed-timeout'] || 0) + Number(stats.failure || 0);
  if (malicious > 0) return { color: 0xed4245, title: "🚫 Potential virus detected — DO NOT DOWNLOAD", text: `${malicious} engine(s) reported malicious content. Do not download or open this file. Staff review is needed.` };
  if (suspicious > 0 || failed > 0 || checked <= 0) return { color: 0xfee75c, title: "⚠️ May be unsafe — staff review needed", text: "The scan is suspicious or incomplete. Do not download or open this file until staff have reviewed it." };
  return { color: 0x57f287, title: "✅ Scan complete — no threats detected", text: "VirusTotal reported no detections. This does not guarantee that the file is safe." };
}
