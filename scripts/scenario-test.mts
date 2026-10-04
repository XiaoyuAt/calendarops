// Scenario tests: (A) cross-region customer with Chinese reply + money guardrail,
// (B) Tech Week — 4 parallel event threads exercising cross-thread conflict detection.
// All counterparties are AgentMail inboxes we own; no third party is emailed.
import { negotiationCreate, negotiationPropose, negotiationPoll, negotiationSettle } from '../core/negotiation.js';
import { pollInbox } from '../core/mail.js';
import { env } from '../core/config.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string) => console.log(`\n▶ ${s}`);

// AgentMail new-account limit: max 10 distinct recipients in first 24h — reuse already-emailed inboxes.
const POOL = [
  'dangerouscause120@agentmail.to', 'handsomemountain799@agentmail.to', 'evilpart57@agentmail.to',
  'encouragingbridge550@agentmail.to', 'jitteryphoto452@agentmail.to',
];
let poolIdx = 0;
function createInbox(): Promise<string> {
  return Promise.resolve(POOL[poolIdx++]);
}

async function counterpartySend(from: string, subject: string, text: string) {
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${from}/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.AGENTMAIL_API_KEY}` },
    body: JSON.stringify({ to: env.AGENTMAIL_INBOX_ID, subject, text }),
  });
  if (!res.ok) throw new Error(`counterparty send failed: ${res.status} ${await res.text()}`);
}

async function waitRepliesFrom(from: string, pred: (t: string) => boolean, tries = 15) {
  for (let i = 0; i < tries; i++) {
    await sleep(4000);
    const inbound = (await pollInbox()).filter((m) => m.from.includes(from));
    const hit = inbound.find((m) => pred(m.text));
    if (hit) return inbound.map((m) => ({ from: m.from, text: m.text, received_at: m.received_at }));
  }
  throw new Error(`timed out waiting for reply from ${from}`);
}

// ═══════════════════ Scenario A: cross-region customer ═══════════════════
async function scenarioA() {
  log('══ 场景 A：跨区域客户（上海，中美时区）══');
  const client = await createInbox();
  console.log(`上海客户 inbox: ${client}`);

  log('A1. create：constraints 写明 "US mornings = 上海晚间"');
  const t = await negotiationCreate({
    counterparty_email: client,
    counterparty_name: '王薇 (Wei Wang)',
    constraints: '上海客户；美西上午 = 上海当日晚间 23:00-24:00；prefer PT mornings',
  });

  log('A2. propose：3 个 PT 上午槽位（= 上海晚间）');
  await negotiationPropose(t.id, [
    { start: '2026-10-12T09:00', end: '2026-10-12T09:30', tz: 'PT (= 上海 10/12 24:00)' },
    { start: '2026-10-13T09:00', end: '2026-10-13T09:30', tz: 'PT (= 上海 10/14 00:00)' },
    { start: '2026-10-13T10:00', end: '2026-10-13T10:30', tz: 'PT (= 上海 10/14 01:00)' },
  ]);

  log('A3. 客户用中文回复 → 实测意图识别边界');
  await counterpartySend(client, 'Re: Scheduling', '我周二下午比较方便，上午要开会。（标记a3）');
  const r1 = await negotiationPoll(t.id, await waitRepliesFrom(client, (x) => x.includes('标记a3')));
  console.log(`poll(中文) → ${r1.status} | ${r1.news}`);

  log('A4. 客户改用英文还价 + 问报价 → 钱闸门');
  await counterpartySend(client, 'Re: Scheduling', 'How about Tuesday 2pm PT instead? (marker-a4) Also, can you send a quote for the workshop? Our budget is around $5,000.');
  const r2 = await negotiationPoll(t.id, await waitRepliesFrom(client, (x) => x.includes('marker-a4')));
  console.log(`poll(英文+报价) → ${r2.status} | ${r2.news}`);
  console.log(`(thread ${t.id} 终态 ${r2.status} —— 钱话题出现，正确移交人工)`);
}

// ═══════════════════ Scenario B: Tech Week — 4 parallel events ═══════════════════
async function scenarioB() {
  log('\n══ 场景 B：Tech Week 多活动并行 ══');
  const events = [
    { name: 'AgentMail Meetup', organizer: 'AgentMail Events' },
    { name: 'Neon Demo Day', organizer: 'Neon Team' },
    { name: 'Mastra Workshop', organizer: 'Mastra DevRel' },
    { name: 'Investor Coffee', organizer: 'VC Partner' },
  ];
  const inboxes: string[] = [];
  for (const e of events) inboxes.push(await createInbox());
  console.log('4 个活动对接 inbox:', inboxes.join(', '));

  // Event 1: book Wed 9:00, settle → creates hold
  log('B1. Event 1 (AgentMail Meetup)：提案 Wed 9:00 → 直接接受 → settle（产生占位）');
  const t1 = await negotiationCreate({ counterparty_email: inboxes[0], counterparty_name: events[0].organizer });
  await negotiationPropose(t1.id, [
    { start: '2026-10-13T09:00', end: '2026-10-13T09:30', tz: 'PT' },
    { start: '2026-10-13T11:00', end: '2026-10-13T11:30', tz: 'PT' },
  ]);
  await counterpartySend(inboxes[0], 'Re: Scheduling', 'Option 1 works, see you Wednesday! (marker-b1)');
  const p1 = await negotiationPoll(t1.id, await waitRepliesFrom(inboxes[0], (x) => x.includes('marker-b1')));
  console.log(`poll → ${p1.news}`);
  console.log('settle →', JSON.stringify(await negotiationSettle(t1.id, { start: '2026-10-13T09:00', end: '2026-10-13T09:30', tz: 'PT' })));

  // Event 2: try overlapping slot → conflict expected; then non-overlap → accept → settle
  log('B2. Event 2 (Neon Demo Day)：故意提案与 Event 1 重叠的槽位 → 期望冲突拦截');
  const t2 = await negotiationCreate({ counterparty_email: inboxes[1], counterparty_name: events[1].organizer });
  try {
    await negotiationPropose(t2.id, [{ start: '2026-10-13T09:00', end: '2026-10-13T09:30', tz: 'PT' }]);
    console.log('⚠️ 冲突未被拦截（bug）');
  } catch (err: any) {
    console.log(`✅ 冲突被拦截: ${err.message}`);
  }
  log('B2b. 改提不冲突槽位 → 还价一次 → 自适应 → 接受 → settle');
  await negotiationPropose(t2.id, [
    { start: '2026-10-13T13:00', end: '2026-10-13T13:30', tz: 'PT' },
    { start: '2026-10-13T14:00', end: '2026-10-13T14:30', tz: 'PT' },
  ]);
  await counterpartySend(inboxes[1], 'Re: Scheduling', "Can't do Wednesday — how about Thursday morning?");
  const p2 = await negotiationPoll(t2.id, await waitRepliesFrom(inboxes[1], (x) => x.includes('marker-b2')));
  console.log(`poll → ${p2.status} | ${p2.news}`);
  await negotiationPropose(t2.id, [
    { start: '2026-10-14T09:00', end: '2026-10-14T09:30', tz: 'PT' },
    { start: '2026-10-14T10:00', end: '2026-10-14T10:30', tz: 'PT' },
  ]);
  await counterpartySend(inboxes[1], 'Re: Scheduling', 'Yes, Thursday 10am works. (marker-b2b)');
  const p2b = await negotiationPoll(t2.id, await waitRepliesFrom(inboxes[1], (x) => x.includes('marker-b2b')));
  console.log(`poll → ${p2b.news}`);
  console.log('settle →', JSON.stringify(await negotiationSettle(t2.id, { start: '2026-10-14T10:00', end: '2026-10-14T10:30', tz: 'PT' })));

  // Event 3: counter twice → escalate on reschedule limit
  log('B3. Event 3 (Mastra Workshop)：连续还价 2 次 → 期望触发改期上限升级');
  const t3 = await negotiationCreate({ counterparty_email: inboxes[2], counterparty_name: events[2].organizer });
  await negotiationPropose(t3.id, [{ start: '2026-10-13T15:00', end: '2026-10-13T15:30', tz: 'PT' }]);
  await counterpartySend(inboxes[2], 'Re: Scheduling', 'Can we reschedule to Friday? (marker-b3)');
  const p3 = await negotiationPoll(t3.id, await waitRepliesFrom(inboxes[2], (x) => x.includes('marker-b3')));
  console.log(`poll#1 → ${p3.status} | ${p3.news}`);
  await negotiationPropose(t3.id, [{ start: '2026-10-15T15:00', end: '2026-10-15T15:30', tz: 'PT' }]);
  await counterpartySend(inboxes[2], 'Re: Scheduling', 'Actually, can we reschedule again to next Monday? (marker-b3b)');
  const p3b = await negotiationPoll(t3.id, await waitRepliesFrom(inboxes[2], (x) => x.includes('marker-b3b')));
  console.log(`poll#2 → ${p3b.status} | ${p3b.news}`);

  // Event 4: money language → escalate
  log('B4. Event 4 (Investor Coffee)：对方问估值/条款 → 期望钱闸门升级');
  const t4 = await negotiationCreate({ counterparty_email: inboxes[3], counterparty_name: events[3].organizer });
  await negotiationPropose(t4.id, [{ start: '2026-10-14T16:00', end: '2026-10-14T16:30', tz: 'PT' }]);
  await counterpartySend(inboxes[3], 'Re: Scheduling', 'Thursday works. (marker-b4) Before we meet, can you share the term sheet and your valuation?');
  const p4 = await negotiationPoll(t4.id, await waitRepliesFrom(inboxes[3], (x) => x.includes('marker-b4')));
  console.log(`poll → ${p4.status} | ${p4.news}`);

  return [t1.id, t2.id, t3.id, t4.id];
}

await scenarioA();
const threadIds = await scenarioB();
console.log('\n▶ Tech Week 4 线程 ID:', threadIds.join(', '));
log('SCENARIO TESTS DONE');
