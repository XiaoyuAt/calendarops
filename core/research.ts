// Counterparty research via Exa — informs negotiation posture.
// Live when EXA_API_KEY set; heuristic mock otherwise.
import { env } from './config.js';

export interface Brief { company?: string; role?: string; posture: 'accommodate' | 'firm' | 'neutral'; note: string }

export async function research(name: string, email?: string): Promise<Brief> {
  if (env.EXA_API_KEY) {
    try {
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.EXA_API_KEY },
        body: JSON.stringify({ query: `${name} ${email?.split('@')[1] ?? ''}`, numResults: 3, type: 'auto' }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const top = data.results?.[0];
        const domain = email?.split('@')[1] ?? '';
        const posture = /client|customer|buyer/i.test(top?.title ?? '') ? 'accommodate'
          : /vendor|supplier|agency/i.test(top?.title ?? '') ? 'firm' : 'neutral';
        return { company: domain, role: top?.title, posture, note: top?.text?.slice(0, 200) ?? '' };
      }
    } catch { /* fall through to heuristic */ }
  }
  // heuristic mock
  const domain = email?.split('@')[1] ?? '';
  const posture: Brief['posture'] = /client|pharma|biotech/i.test(domain) ? 'accommodate' : 'neutral';
  return { company: domain, posture, note: `[mock brief] ${name} @ ${domain}` };
}
