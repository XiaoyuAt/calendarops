// Unit-level verification of the escalation gates after the MONEY_RE fix.
import { escalationGates, nextStatus } from '../core/state.js';
import type { Thread } from '../core/config.js';

const t = (round: number) =>
  ({ id: 'x', counterparty_email: 'a@b.c', status: 'COUNTERED', round }) as Thread;

// B3: after 1st counter (round=1), counterparty reschedules again
const g3 = escalationGates(t(1), 'Actually, can we reschedule again to next Monday?', new Date());
console.log('B3 gates      →', JSON.stringify(g3));
console.log('B3 nextStatus →', nextStatus(t(1), 'counter'));

// B4: investor asks for term sheet / valuation
const g4 = escalationGates(t(0), 'Thursday works. Before we meet, can you share the term sheet and your valuation?', new Date());
console.log('B4 gates      →', JSON.stringify(g4));

// Regression: pure scheduling language must NOT trip the money gate anymore
const g5 = escalationGates(t(0), 'How about next Monday? Also please add it to my calendar.', new Date());
console.log('回归 周一+calendar →', JSON.stringify(g5));
