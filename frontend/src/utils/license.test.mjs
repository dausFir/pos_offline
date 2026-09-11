import assert from 'node:assert/strict';
import test from 'node:test';
import { isLicenseToken } from './license.mjs';

test('accepts the signed offline license token envelope only', () => {
  assert.equal(isLicenseToken('poslic-v1.eyJpZCI6MX0.signed_value'), true);
  assert.equal(isLicenseToken('poslic-v1.payload.signature.'), false);
  assert.equal(isLicenseToken('not-a-license'), false);
  assert.equal(isLicenseToken(''), false);
});
