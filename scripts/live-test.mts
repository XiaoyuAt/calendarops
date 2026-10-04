// One-off live self-test: real email through the AgentMail inbox.
import { sendMail } from '../core/mail.js';

const msg = await sendMail(
  process.env.REAL_TO,
  'CalendarOps live self-test',
  'Agent inbox works end-to-end from the calops workspace. — CalendarOps',
);
console.log('sent:', JSON.stringify(msg));
