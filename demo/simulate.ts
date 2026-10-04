#!/usr/bin/env node
// End-to-end demo: happy path + both escalation gates.
// `npm run demo`       — in-memory, zero infra, cannot fail
// `npm run demo:live`  — real AgentMail inbox (set .env)
import { negotiationCreate, negotiationPropose, negotiationPoll, negotiationSettle } from '../core/negotiation.js';
import { sendMail } from '../core/mail.js';
import { LIVE, env } from '../core/config.js';

const D = (s: string) => console.log(`\n\x1b[1m── ${s} ──\x1b[0m`);

D('1/7 create — counterparty researched');
const t = await negotiationCreate({
  counterparty_email: 'bd.director@clientpharma.com',
  counterparty_name: 'BD Director',
  constraints: 'mornings only; timezone PT',
});
console.log(`thread ${t.id} → ${t.status} (posture: ${t.constraints})`);

D('2/7 propose — 3 slots, conflict-checked');
await negotiationPropose(t.id, [
  { start: '2026-10-06T09:00', end: '2026-10-06T09:30', tz: 'PT' },
  { start: '2026-10-06T10:00', end: '2026-10-06T10:30', tz: 'PT' },
  { start: '2026-10-07T09:00', end: '2026-10-07T09:30', tz: 'PT' },
]);

D('3/7 counterparty accepts option 2');
const accepted = await negotiationPoll(t.id, [
  { from: 'bd.director@clientpharma.com', text: 'Option 2 works great for me. Confirmed!', received_at: new Date().toISOString() },
]);
console.log(accepted);

D('4/7 settle — tentative hold + confirm email');
const settled = await negotiationSettle(t.id, { start: '2026-10-06T10:00', end: '2026-10-06T10:30', tz: 'PT' });
console.log(settled);

D('5/7 NEW thread — money language gate');
const t2 = await negotiationCreate({ counterparty_email: 'vendor@agency.io', counterparty_name: 'Agency Vendor' });
await negotiationPropose(t2.id, [{ start: '2026-10-08T14:00', end: '2026-10-08T15:00', tz: 'PT' }]);
const money = await negotiationPoll(t2.id, [
  { from: 'vendor@agency.io', text: 'Before we meet — the invoice is $12,000, can you confirm payment terms?', received_at: new Date().toISOString() },
]);
console.log(money.news);

D('6/7 NEW thread — reschedule-limit gate');
const t3 = await negotiationCreate({ counterparty_email: 'flaky@startup.dev', counterparty_name: 'Flaky Founder' });
await negotiationPropose(t3.id, [{ start: '2026-10-09T11:00', end: '2026-10-09T11:30', tz: 'PT' }]);
await negotiationPoll(t3.id, [{ from: 'flaky@startup.dev', text: 'Can we do 3pm instead?', received_at: new Date().toISOString() }]);
await negotiationPropose(t3.id, [{ start: '2026-10-09T15:00', end: '2026-10-09T15:30', tz: 'PT' }]);
const flaky = await negotiationPoll(t3.id, [{ from: 'flaky@startup.dev', text: 'Actually how about next week?', received_at: new Date().toISOString() }]);
console.log(flaky.news);

D('7/7 live inbox self-test (if LIVE)');
if (LIVE && env.REAL_TO) {
  await sendMail(env.REAL_TO, 'CalendarOps live self-test', 'If you can read this, the agent inbox works end-to-end. — CalendarOps');
  console.log('live email sent → check ' + env.REAL_TO);
} else {
  console.log('(skipped — run with LIVE=1 and REAL_TO=you@x.com)');
}

console.log('\n✅ demo complete — happy path + both escalation gates exercised\n');
