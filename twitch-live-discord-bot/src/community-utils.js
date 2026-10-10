import { randomInt } from "node:crypto";

export function parseDuration(value) {
  const match = /^(\d+)(s|m|h|d)$/i.exec(value.trim());
  if (!match) return null;
  const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const duration = Number(match[1]) * unitMs[match[2].toLowerCase()];
  return duration >= 10_000 && duration <= 30 * 86_400_000 ? duration : null;
}

export function chooseWinners(entries, count, random = randomInt) {
  const pool = [...new Set(entries)];
  const winners = [];
  while (pool.length > 0 && winners.length < count) {
    winners.push(pool.splice(random(pool.length), 1)[0]);
  }
  return winners;
}

