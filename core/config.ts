// CalendarOps core — shared types & config
export interface Slot { start: string; end: string; tz?: string }
export type ThreadStatus = 'INVITED' | 'PROPOSED' | 'COUNTERED' | 'CONFIRMED' | 'ESCALATED' | 'EXPIRED';

export interface Thread {
  id: string;
  counterparty_email: string;
  counterparty_name?: string;
  company?: string;
  constraints?: string;
  status: ThreadStatus;
  round: number;
  escalated_reason?: string;
}

export interface Proposal {
  id: string;
  thread_id: string;
  slots: Slot[];
  outcome?: 'ACCEPTED' | 'COUNTERED' | 'IGNORED';
}

export interface Env {
  AGENTMAIL_API_KEY?: string;
  AGENTMAIL_INBOX_ID?: string;
  AGENTMAIL_ADDRESS?: string;
  DATABASE_URL?: string;
  EXA_API_KEY?: string;
  REAL_TO?: string;
  LIVE?: string;
}

export const env: Env = { ...process.env as any };
export const LIVE = env.LIVE === '1';
