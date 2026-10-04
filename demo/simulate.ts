#!/usr/bin/env node
// Full-autonomy demo: hands-free scheduling loop + the money-line guardrail (one feature, not the identity).
// `npm run demo`       — in-memory, zero infra, cannot fail
// `npm run demo:live`  — real AgentMail inbox (set .env)
import { negotiationCreate, negotiationPropose, negotiationPoll, negotiationSettle } from '../core/negotiation.js';
import { sendMail } from '../core/mail.js';
import { LIVE, env } from '../core/config.js';

const D = (s: string) => console.log(`\n\x1b[1m── ${s} ──\x1b[0m`);

D('1/7 a meeting request arrives');
console.log('You forward: "Book time with Sarah Chen, BD @ clientpharma.com — next week, mornings"');

D('2/7 agent researches the counterparty');
const t = await negotiationCreate({
  counterparty_email: 'sarah.chen@clientpharma.com',
  counterparty_name: 'Sarah Chen',
  constraints: 'mornings only; timezone PT',
});
console.log(`thread opened → posture: accommodate (client domain)`);

D('3/7 agent proposes slots (conflict-checked)');
await negotiationPropose(t.id, [
  { start: '2026-10-06T09:00', end: '2026-10-06T09:30', tz: 'PT' },
  { start: '2026-10-06T10:00', end: '2026-10-06T10:30', tz: 'PT' },
  { start: '2026-10-07T09:00', end: '2026-10-07T09:30', tz: 'PT' },
]);

D('4/7 counterparty counters → agent adapts automatically');
await negotiationPoll(t.id, [
  { from: 'sarah.chen@clientpharma.com', text: 'Can we do Tuesday afternoon instead?', received_at: new Date().toISOString() },
]);
await negotiationPropose(t.id, [
  { start: '2026-10-06T14:00', end: '2026-10-06T14:30', tz: 'PT' },
  { start: '2026-10-06T15:00', end: '2026-10-06T15:30', tz: 'PT' },
]);

D('5/7 acceptance → booked + prep brief lands in YOUR inbox');
const settled = await negotiationSettle(t.id, { start: '2026-10-06T15:00', end: '2026-10-06T15:30', tz: 'PT' });
console.log(settled);

D('6/7 you did nothing the entire time');
console.log('No clicking. No threading. No timezone math. One forwarded email in, one prep brief out.');

D('7/7 one guardrail remains: money language hands off to you');
const t2 = await negotiationCreate({ counterparty_email: 'vendor@agency.io', counterparty_name: 'Agency Vendor' });
await negotiationPropose(t2.id, [{ start: '2026-10-08T14:00', end: '2026-10-08T15:00', tz: 'PT' }]);
const money = await negotiationPoll(t2.id, [
  { from: 'vendor@agency.io', text: 'Before we meet — the invoice is $12,000, can you confirm payment terms?', received_at: new Date().toISOString() },
]);
console.log(money.news);

if (LIVE && env.REAL_TO) {
  await sendMail(env.REAL_TO, 'CalendarOps live self-test', 'The agent inbox works end-to-end. — CalendarOps');
}
console.log('\n✅ full-autonomy loop demo complete\n');
