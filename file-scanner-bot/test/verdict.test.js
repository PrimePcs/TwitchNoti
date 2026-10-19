import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdict } from '../src/verdict.js';

test('malicious detections warn against download even with clean engines', () => {
  assert.match(verdict({ malicious: 1, undetected: 60 }).title, /DO NOT DOWNLOAD/);
});
test('suspicious, empty, and incomplete scans require review', () => {
  for (const stats of [{ suspicious: 1 }, {}, { undetected: 40, timeout: 1 }]) {
    assert.match(verdict(stats).title, /staff review needed/);
  }
});
test('completed clean reports state no detections without guaranteeing safety', () => {
  const result = verdict({ undetected: 60, harmless: 2 });
  assert.match(result.title, /no threats detected/);
  assert.match(result.text, /does not guarantee/);
});
