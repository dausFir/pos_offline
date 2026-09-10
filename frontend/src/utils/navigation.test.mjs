import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomePath } from './navigation.mjs';

test('opens the owner workspace for admin roles', () => {
  assert.equal(getHomePath('admin'), '/dashboard');
  assert.equal(getHomePath('super_admin'), '/dashboard');
});

test('opens the fast cashier workspace for operational roles', () => {
  assert.equal(getHomePath('cashier'), '/pos');
  assert.equal(getHomePath(undefined), '/pos');
});
