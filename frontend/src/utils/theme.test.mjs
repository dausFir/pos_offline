import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, nextTheme, normalizeTheme } from './theme.mjs';

test('normalizes only the supported RapiPos themes', () => {
  assert.equal(normalizeTheme(THEMES.DARK), THEMES.DARK);
  assert.equal(normalizeTheme(THEMES.LIGHT), THEMES.LIGHT);
  assert.equal(normalizeTheme('system'), THEMES.LIGHT);
  assert.equal(normalizeTheme(null), THEMES.LIGHT);
});

test('toggles between light and dark without an invalid state', () => {
  assert.equal(nextTheme(THEMES.LIGHT), THEMES.DARK);
  assert.equal(nextTheme(THEMES.DARK), THEMES.LIGHT);
  assert.equal(nextTheme('unexpected'), THEMES.DARK);
});
