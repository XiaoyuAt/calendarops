// Full live loop test: real AgentMail email in BOTH directions + real Neon DB + real Exa.
// The "counterparty" is the user's other own inbox (xiaoyu-3584@agentmail.to) so no third party gets emailed.
import { negotiationCreate, negotiationPropose, negotiationPoll, negotiationSettle } from '../core/negotiation.js';
import { pollInbox } from '../core/mail.js';
import { env } from '../core/config.js';

const COUNTERPARTY = 'xiaoyu-3584@agentmail.to';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function counterpartySend(subject: string, text: string) {
  // send FROM the counterparty inbox using the org Full Access key (raw call, bypasses mail.ts)
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${COUNTERPARTY}/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.AGENTMAIL_API_KEY}` },
    body: JSON.stringify({ to: env.AGENTMAIL_INBOX_ID, subject, text }),
  });
  if (!res.ok) throw new Error(`counterparty send failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function waitForInbound(pred: (m: any) => boolean, tries = 12): Promise<any[]> {
  for (let i = 0; i < tries; i++) {
    await sleep(5000);
    const inbound = await pollInbox();
    const matched = inbound.filter(pred);
    if (matched.length) return inbound;
  }
  throw new Error('timed out waiting for inbound mail');
}

const log = (s: string) => console.log(`\n▶ ${s}`);

// ── 1. create thread (real Exa research) ──
log('1. negotiationCreate (real Exa research + Neon insert)');
const t = await negotiationCreate({
  counterparty_email: COUNTERPARTY,
  counterparty_name: 'Loop Test Counterparty',
  constraints: 'mornings PT',
});
console.log(`thread ${t.id} status=${t.status}`);

// ── 2. propose slots (real email to counterparty inbox) ──
log('2. negotiationPropose (real email out)');
await negotiationPropose(t.id, [
  { start: '2026-10-07T09:00', end: '2026-10-07T09:30', tz: 'PT' },
  { start: '2026-10-07T10:00', end: '2026-10-07T10:30', tz: 'PT' },
]);

// ── 3. counterparty counters (real email in) ──
log('3. counterparty sends counterproposal (real email in)');
await counterpartySend('Re: Scheduling: a few times that work', 'Mornings are tough for me — can we do Tuesday afternoon instead?');
const inbound1 = await waitForInbound((m) => m.from.includes(COUNTERPARTY) && /afternoon/i.test(m.text));
const r1 = await negotiationPoll(t.id, inbound1.map((m) => ({ from: m.from, text: m.text, received_at: m.received_at })));
console.log('poll →', r1.status, '|', r1.news);

// ── 4. agent adapts and re-proposes (real email out) ──
log('4. agent re-proposes afternoon slots (real email out)');
await negotiationPropose(t.id, [
  { start: '2026-10-08T14:00', end: '2026-10-08T14:30', tz: 'PT' },
  { start: '2026-10-08T15:00', end: '2026-10-08T15:30', tz: 'PT' },
]);

// ── 5. counterparty accepts option 2 (real email in) ──
log('5. counterparty accepts (real email in)');
await counterpartySend('Re: Scheduling: a few times that work', 'Option 2 works for me. See you then!');
const inbound2 = await waitForInbound((m) => m.from.includes(COUNTERPARTY) && /works for me/i.test(m.text));
const r2 = await negotiationPoll(t.id, inbound2.map((m) => ({ from: m.from, text: m.text, received_at: m.received_at })));
console.log('poll →', r2.status, '|', r2.news);

// ── 6. settle: tentative hold + confirmation + owner prep brief (real emails) ──
log('6. negotiationSettle (hold + confirmation + owner brief)');
const settled = await negotiationSettle(t.id, { start: '2026-10-08T15:00', end: '2026-10-08T15:30', tz: 'PT' });
console.log('settled →', JSON.stringify(settled));

log('LIVE LOOP TEST PASSED');
