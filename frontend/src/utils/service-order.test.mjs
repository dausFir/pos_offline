import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canManageServiceOrder,
  getAllowedServiceStatuses,
  isTerminalServiceStatus,
  toPositiveNumber,
} from './service-order.mjs';

test('service order only presents valid next workflow steps', () => {
  assert.deepEqual(getAllowedServiceStatuses('received'), ['diagnosis', 'awaiting_approval', 'awaiting_parts', 'in_progress', 'ready', 'cancelled']);
  assert.deepEqual(getAllowedServiceStatuses('ready'), ['cancelled']);
  assert.deepEqual(getAllowedServiceStatuses('completed'), []);
  assert.deepEqual(getAllowedServiceStatuses('unknown'), []);
});

test('terminal and invoiced service orders cannot be changed from the UI', () => {
  assert.equal(isTerminalServiceStatus('cancelled'), true);
  assert.equal(canManageServiceOrder({ status: 'in_progress' }), true);
  assert.equal(canManageServiceOrder({ status: 'cancelled' }), false);
  assert.equal(canManageServiceOrder({ status: 'ready', invoice_number: 'INV-1' }), false);
});

test('service monetary input accepts positive finite values only', () => {
  assert.equal(toPositiveNumber('25000'), 25000);
  assert.equal(toPositiveNumber(0), null);
  assert.equal(toPositiveNumber('-1'), null);
  assert.equal(toPositiveNumber('not-a-number'), null);
});
