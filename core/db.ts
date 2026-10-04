// Persistence — Neon Postgres when DATABASE_URL is set, in-memory store otherwise.
// In-memory mode guarantees the demo NEVER dies on infra. Neon mode is the real thing.
import { neon } from '@neondatabase/serverless';
import { env } from './config.js';
import type { Thread, Proposal, Slot } from './config.js';

const sql = env.DATABASE_URL ? neon(env.DATABASE_URL) : null;

// ---- in-memory fallback ----
const threads = new Map<string, Thread>();
const proposals = new Map<string, Proposal[]>();
const holds = new Map<string, { thread_id: string; slot: Slot; status: string }[]>();

const uid = () => Math.random().toString(36).slice(2, 10);

export async function createThread(input: Pick<Thread, 'counterparty_email'> & Partial<Thread>): Promise<Thread> {
  if (sql) {
    const rows = await sql`insert into negotiation_thread (counterparty_email, counterparty_name, company, constraints)
      values (${input.counterparty_email}, ${input.counterparty_name ?? null}, ${input.company ?? null}, ${input.constraints ?? null})
      returning *`;
    return rowToThread(rows[0]);
  }
  const t: Thread = { id: uid(), status: 'INVITED', round: 0, ...input } as Thread;
  threads.set(t.id, t);
  return t;
}

export async function getThread(id: string): Promise<Thread | null> {
  if (sql) {
    const rows = await sql`select * from negotiation_thread where id = ${id}`;
    return rows[0] ? rowToThread(rows[0]) : null;
  }
  return threads.get(id) ?? null;
}

export async function updateThread(id: string, patch: Partial<Thread>): Promise<Thread | null> {
  if (sql) {
    const rows = await sql`update negotiation_thread set
      status = coalesce(${patch.status ?? null}, status),
      round = coalesce(${patch.round ?? null}, round),
      escalated_reason = ${patch.escalated_reason ?? null},
      updated_at = now()
      where id = ${id} returning *`;
    return rows[0] ? rowToThread(rows[0]) : null;
  }
  const t = threads.get(id);
  if (!t) return null;
  Object.assign(t, patch);
  return t;
}

export async function saveProposal(threadId: string, slots: Slot[]): Promise<Proposal> {
  if (sql) {
    const rows = await sql`insert into proposal (thread_id, slots) values (${threadId}, ${JSON.stringify(slots)}::jsonb) returning *`;
    return { id: rows[0].id, thread_id: threadId, slots };
  }
  const p: Proposal = { id: uid(), thread_id: threadId, slots };
  const list = proposals.get(threadId) ?? [];
  list.push(p);
  proposals.set(threadId, list);
  return p;
}

export async function holdSlot(threadId: string, slot: Slot): Promise<{ status: string }> {
  if (sql) {
    await sql`insert into calendar_hold (thread_id, slot) values (${threadId}, ${JSON.stringify(slot)}::jsonb)`;
    return { status: 'tentative' };
  }
  const list = holds.get(threadId) ?? [];
  list.push({ thread_id: threadId, slot, status: 'tentative' });
  holds.set(threadId, list);
  return { status: 'tentative' };
}

// naive busy-check for demo purposes
export async function getBusySlots(): Promise<Slot[]> {
  if (sql) {
    const rows = await sql`select slot from calendar_hold`;
    return rows.map((r: any) => r.slot);
  }
  return [...holds.values()].flat().map(h => h.slot);
}

function rowToThread(r: any): Thread {
  return { id: r.id, counterparty_email: r.counterparty_email, counterparty_name: r.counterparty_name,
    company: r.company, constraints: r.constraints, status: r.status, round: r.round, escalated_reason: r.escalated_reason };
}
