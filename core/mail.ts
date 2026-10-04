// AgentMail client — real API in LIVE mode, deterministic mock otherwise.
// AgentMail API: https://docs.agentmail.to (REST: /v0/inboxes/{inbox_id}/messages)
import { LIVE, env } from './config.js';

const BASE = 'https://api.agentmail.to/v0';

export interface SentMessage { id: string; to: string; subject: string; thread_id?: string }

export async function sendMail(to: string, subject: string, text: string): Promise<SentMessage> {
  if (LIVE && env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) {
    const res = await fetch(`${BASE}/inboxes/${env.AGENTMAIL_INBOX_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.AGENTMAIL_API_KEY}` },
      body: JSON.stringify({ to: [{ email: to }], subject, text }),
    });
    if (!res.ok) throw new Error(`AgentMail send failed: ${res.status} ${await res.text()}`);
    return await res.json() as SentMessage;
  }
  // mock: log only
  console.log(`📧 [mock] → ${to}\n   Subject: ${subject}\n   ${text.split('\n').map(l => '   ' + l).join('\n')}`);
  return { id: `mock_${Date.now()}`, to, subject };
}

export interface InboundMessage { id: string; from: string; subject: string; text: string; received_at: string }

export async function pollInbox(): Promise<InboundMessage[]> {
  if (LIVE && env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) {
    const res = await fetch(`${BASE}/inboxes/${env.AGENTMAIL_INBOX_ID}/messages?limit=10`, {
      headers: { 'Authorization': `Bearer ${env.AGENTMAIL_API_KEY}` },
    });
    if (!res.ok) throw new Error(`AgentMail poll failed: ${res.status}`);
    const data = await res.json() as any;
    return (data.messages ?? data ?? []).map((m: any) => ({
      id: m.id, from: m.from?.[0]?.email ?? m.from, subject: m.subject ?? '',
      text: m.text ?? m.body ?? '', received_at: m.created_at ?? new Date().toISOString(),
    }));
  }
  return []; // mock: inbound driven by demo script, not real polling
}
