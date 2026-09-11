export const SERVICE_STATUS = Object.freeze({
  received: 'Diterima',
  diagnosis: 'Diagnosis',
  awaiting_approval: 'Menunggu Persetujuan',
  awaiting_parts: 'Menunggu Sparepart',
  in_progress: 'Dikerjakan',
  ready: 'Siap Diambil',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
});

const TRANSITIONS = Object.freeze({
  received: ['diagnosis', 'awaiting_approval', 'awaiting_parts', 'in_progress', 'ready', 'cancelled'],
  diagnosis: ['awaiting_approval', 'awaiting_parts', 'in_progress', 'ready', 'cancelled'],
  awaiting_approval: ['diagnosis', 'awaiting_parts', 'in_progress', 'cancelled'],
  awaiting_parts: ['in_progress', 'ready', 'cancelled'],
  in_progress: ['awaiting_parts', 'ready', 'cancelled'],
  ready: ['cancelled'],
  completed: [],
  cancelled: [],
});

export function getAllowedServiceStatuses(status) {
  return TRANSITIONS[status] || [];
}

export function isTerminalServiceStatus(status) {
  return status === 'completed' || status === 'cancelled';
}

export function canManageServiceOrder(order) {
  return Boolean(order) && !order.invoice_number && !isTerminalServiceStatus(order.status);
}

export function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
