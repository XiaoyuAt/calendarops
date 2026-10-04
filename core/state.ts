// Negotiation state machine + escalation guardrails
import type { Thread, ThreadStatus } from './config.js';

export const MAX_ROUNDS = 2;           // counterparty may reschedule at most twice
export const EXPIRY_HOURS = 48;        // unclosed loop escalates

export function nextStatus(t: Thread, event: 'propose' | 'accept' | 'counter' | 'expire'): ThreadStatus {
  switch (event) {
    case 'propose': return 'PROPOSED';
    case 'accept':  return 'CONFIRMED';
    case 'counter':
      return (t.round + 1) >= MAX_ROUNDS ? 'ESCALATED' : 'COUNTERED';
    case 'expire':  return 'EXPIRED';
  }
}

/** All escalation gates live here — one function, easy to audit, demo-able. */
export interface GateResult { escalate: boolean; reason?: string }

const MONEY_RE = /\$\s?\d|\bUSD\b|\bEUR\b|¥|£|invoice|payment|contract|price|quote|deposit|NDA/i;

export function escalationGates(t: Thread, bodyText: string, lastActivityAt: Date, now = new Date()): GateResult {
  if (t.round >= MAX_ROUNDS) return { escalate: true, reason: `counterparty changed ${t.round}x — over reschedule limit` };
  if (MONEY_RE.test(bodyText)) return { escalate: true, reason: 'money/contract language detected — human approval required' };
  const hrs = (now.getTime() - lastActivityAt.getTime()) / 36e5;
  if (hrs >= EXPIRY_HOURS) return { escalate: true, reason: `no closure in ${hrs.toFixed(0)}h` };
  return { escalate: false };
}

/** Multi-party check: >3 distinct participants escalates. */
export function tooManyParties(allParticipants: string[]): boolean {
  return new Set(allParticipants.map(p => p.toLowerCase())).size > 3;
}
