// AgentMail client — real API in LIVE mode, deterministic mock otherwise.
// AgentMail API: https://docs.agentmail.to (REST: POST /v0/inboxes/{inbox_id}/messages/send)
import { LIVE, env } from './config.js';

const BASE = 'https://api.agentmail.to/v0';

export interface SentMessage { id: string; to: string; subject: string; thread_id?: string }

export async function sendMail(to: string, subject: string, text: string): Promise<SentMessage> {
  if (LIVE && env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) {
    const res = await fetch(`${BASE}/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.AGENTMAIL_API_KEY}` },
      body: JSON.stringify({ to, subject, text }),
    });
    if (!res.ok) throw new Error(`AgentMail send failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { message_id?: string; thread_id?: string };
    return { id: data.message_id ?? `sent_${Date.now()}`, to, subject, thread_id: data.thread_id };
  }
  // mock: log only
  console.log(`📧 [mock] → ${to}\n   Subject: ${subject}\n   ${text.split('\n').map(l => '   ' + l).join('\n')}`);
  return { id: `mock_${Date.now()}`, to, subject };
}

export interface InboundMessage { id: string; from: string; subject: string; text: string; received_at: string }

export async function pollInbox(): Promise<InboundMessage[]> {
  if (LIVE && env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) {
    const auth = { 'Authorization': `Bearer ${env.AGENTMAIL_API_KEY}` };
    const res = await fetch(`${BASE}/inboxes/${env.AGENTMAIL_INBOX_ID}/messages?limit=10`, { headers: auth });
    if (!res.ok) throw new Error(`AgentMail poll failed: ${res.status}`);
    const data = await res.json() as any;
    // AgentMail returns newest-first; the core assumes chronological (latest = last)
    const msgs = (data.messages ?? data ?? [])
      .slice()
      .sort((a: any, b: any) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    return await Promise.all(msgs.map(async (m: any) => {
      // the list endpoint returns bodies as null — fetch each message's text individually
      let text = m.text ?? m.body ?? '';
      const mid = m.message_id ?? m.id;
      if (!text && mid) {
        const detail = await fetch(`${BASE}/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/${encodeURIComponent(mid)}`, { headers: auth });
        if (detail.ok) {
          const d = await detail.json() as any;
          text = d.text ?? d.body ?? '';
        }
      }
      return {
        id: mid, from: m.from?.[0]?.email ?? m.from, subject: m.subject ?? '',
        text, received_at: m.created_at ?? new Date().toISOString(),
      };
    }));
  }
  return []; // mock: inbound driven by demo script, not real polling
}
