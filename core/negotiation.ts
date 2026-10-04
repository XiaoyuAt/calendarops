// CalendarOps — orchestration layer. The whole product in 5 verbs.
// create → propose → poll → (gates) → settle/escalate
import type { Slot, Thread } from './config.js';
import { nextStatus, escalationGates } from './state.js';
import { sendMail } from './mail.js';
import { createThread, getThread, updateThread, saveProposal, holdSlot, getBusySlots } from './db.js';
import { research } from './research.js';

export async function negotiationCreate(input: {
  counterparty_email: string; counterparty_name?: string; constraints?: string;
}): Promise<Thread> {
  const brief = await research(input.counterparty_name ?? '', input.counterparty_email);
  return createThread({ ...input, company: brief.company, constraints: input.constraints ?? brief.posture });
}

export async function negotiationPropose(threadId: string, slots: Slot[]): Promise<{ sent: boolean; email_id: string }> {
  const t = await getThread(threadId);
  if (!t) throw new Error('thread not found');
  if (t.status === 'ESCALATED' || t.status === 'EXPIRED') throw new Error(`thread is ${t.status} — human owns this now`);

  const busy = await getBusySlots();
  const conflicts = slots.filter(s => busy.some(b => s.start < b.end && b.start < s.end));
  if (conflicts.length) throw new Error(`slot conflict detected: ${conflicts.map(c => c.start).join(', ')}`);

  await saveProposal(threadId, slots);
  const subject = `Scheduling: a few times that work`;
  const body = [
    `Hi ${t.counterparty_name ?? ''},`,
    ``,
    `Happy to get this on the calendar. Would any of these work for you?`,
    ...slots.map((s, i) => `  ${i + 1}. ${fmt(s)}`),
    ``,
    `If none fit, send what works on your side and I'll adapt.`,
    ``,
    `— CalendarOps (assistant to Xiaoyu Deng)`,
  ].join('\n');
  const msg = await sendMail(t.counterparty_email, subject, body);
  await updateThread(threadId, { status: nextStatus(t, 'propose') });
  return { sent: true, email_id: msg.id };
}

export async function negotiationPoll(threadId: string, inbound: { from: string; text: string; received_at?: string }[]) {
  const t = await getThread(threadId);
  if (!t) throw new Error('thread not found');
  const relevant = inbound.filter(m => m.from.toLowerCase().includes(t.counterparty_email.toLowerCase()));
  const latest = relevant[relevant.length - 1];
  if (!latest) return { status: t.status, news: 'no reply yet' };

  const gates = escalationGates(t, latest.text, new Date(t.round > 0 ? latest.received_at ?? Date.now() : Date.now()));
  if (gates.escalate) {
    await updateThread(threadId, { status: 'ESCALATED', escalated_reason: gates.reason });
    return { status: 'ESCALATED', news: `⛔ escalated: ${gates.reason}` };
  }
  const lower = latest.text.toLowerCase();
  if (/\b(yes|works|confirmed|slot [123]|option [123]|accept)/.test(lower)) {
    return { status: t.status, news: 'acceptance detected → call settle()', reply: latest.text };
  }
  if (/\b(no|instead|rather|how about|can.?t|reschedule)/.test(lower)) {
    const ns = nextStatus(t, 'counter');
    await updateThread(threadId, { status: ns, round: t.round + 1 });
    return ns === 'ESCALATED'
      ? { status: 'ESCALATED', news: '⛔ escalated: reschedule limit reached (2×) — human owns this now', reply: latest.text }
      : { status: 'COUNTERED', news: 'counterproposal detected — agent re-proposes', reply: latest.text };
  }
  return { status: t.status, news: 'reply needs reading', reply: latest.text };
}

export async function negotiationSettle(threadId: string, slot: Slot): Promise<{ hold: string; brief_sent: boolean; human_signoff: true }> {
  const t = await getThread(threadId);
  if (!t) throw new Error('thread not found');
  if (t.status === 'ESCALATED' || t.status === 'EXPIRED') throw new Error(`thread is ${t.status} — human owns this now`);
  await holdSlot(threadId, slot); // tentative hold; final calendar write stays with the human
  await sendMail(t.counterparty_email, 'Re: Scheduling', `Great — locking in ${fmt(slot)}. Invite to follow.\n— CalendarOps`);
  // THE MAGIC MOMENT: owner gets a meeting-prep brief without asking
  const brief_sent = await sendOwnerBrief(t, slot);
  await updateThread(threadId, { status: 'CONFIRMED' });
  return { hold: 'tentative', brief_sent, human_signoff: true };
}

/** When a meeting is booked, the agent researches the counterparty and drops a prep brief in the OWNER's inbox. */
export async function sendOwnerBrief(t: Thread, slot: Slot): Promise<boolean> {
  const owner = process.env.OWNER_EMAIL ?? process.env.REAL_TO;
  const brief = await research(t.counterparty_name ?? t.counterparty_email, t.counterparty_email);
  const body = [
    `📋 Meeting booked — ${fmt(slot)}`,
    ``,
    `Who: ${t.counterparty_name ?? t.counterparty_email} (${brief.company ?? 'unknown co.'})`,
    `Posture: ${brief.posture}`,
    brief.note ? `Background: ${brief.note}` : '',
    ``,
    `Negotiation took ${t.round} round(s). You did nothing. Enjoy your day.`,
    `— CalendarOps`,
  ].filter(Boolean).join('\n');
  await sendMail(owner ?? 'owner@calendarops.local', `📋 Prep: ${t.counterparty_name ?? t.counterparty_email} — ${fmt(slot)}`, body);
  return true;
}

const fmt = (s: Slot) => `${s.start}–${s.end}${s.tz ? ` (${s.tz})` : ''}`;
