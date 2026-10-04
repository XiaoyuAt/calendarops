# CalendarOps

> **A personal agent with its own inbox that negotiates meeting times over email — and knows what it should NOT do.**

Built at [Neon Build Personal Agents Hack](https://build-personal-agents.com) · SF · Oct 4, 2026

## Why

Scheduling negotiation eats 2–3 hours of every founder's week — proposal emails, counterproposals, reschedules, timezones. CalendarOps owns that entire loop. You forward it a meeting request; it researches the counterparty, proposes slots, negotiates back-and-forth by email from **its own address** (`calendarops@agentmail.to`), and writes a **tentative** hold. The only decision left for you is the final yes.

The author runs a CRO operating across US/China timezones — this is the agent he needs every Monday, not a toy demo.

## Architecture — one core, two shells

```
   Form A (demo)                Form B (any agent)
┌──────────────────┐      ┌─────────────────────────┐
│ Demo script /    │      │ MCP Server (stdio)      │
│ (Mastra/LLM 可接) │      │ 5 tools, same core      │
└────────┬─────────┘      └───────────┬─────────────┘
         └────────────┬───────────────┘
                      ▼
        core/ — pure functions, zero framework
   negotiation.ts (state machine + gates)
                      │
     ┌──────────┬────┴─────┬───────────┐
 AgentMail     Neon      Exa      calendar
 (its own      (thread/  (counter- (tentative
  inbox)        proposal/ party      holds only)
               hold)      research)
```

The entire product is 5 verbs: `create → propose → poll → [gates] → settle | escalate`.

## Capability boundary — the point of this project

An agent is trustworthy when it can articulate what it refuses to do.

**In scope:** propose/accept/counter meeting slots · conflict detection against existing holds · counterparty research for negotiation posture · tentative calendar holds.

**Never (hard-coded refusals):**
- ❌ Cancel meetings — negative externalities always escalate to the human
- ❌ Cold outreach — only replies to threads a human initiated
- ❌ Anything with money or contractual language — regex gate pauses the thread instantly
- ❌ Phone/voice channels

**Automatic escalation to human (tested in demo):**
| Gate | Trigger |
|------|---------|
| Reschedule limit | counterparty changes slots ≥ 2× |
| Loop expiry | no closure in 48h |
| Money/contract language | `$`, `invoice`, `payment`, `contract`, `price`, `quote`, `NDA`… in any reply |
| Multi-party sprawl | > 3 distinct participants |

## Run

```bash
npm install
npm run demo          # full simulation: happy path + both escalation gates. Zero infra needed.
npm run demo:live     # real inbox: set .env (AGENTMAIL_*, REAL_TO=your email)
npm run mcp           # start CalendarOps as an MCP server (stdio)
```

`.env` values: see `.env.example`. Without keys everything runs in mock/in-memory mode — **the demo cannot die on infra.**

## MCP tools

| Tool | What it does |
|------|--------------|
| `negotiation.create` | open thread + research counterparty (Exa) → posture |
| `negotiation.propose` | send slot options by email (conflict-checked) |
| `negotiation.poll` | read replies, run all escalation gates |
| `negotiation.settle` | write tentative hold + send confirmation |
| `context.research` | standalone counterparty lookup |

Add to any MCP client:
```json
{ "calendarops": { "command": "npx", "args": ["tsx", "mcp/server.ts"], "cwd": "/path/to/calendarops" } }
```

## Stack

[AgentMail](https://agentmail.to) (agent's own inbox) · [Neon](https://neon.tech) Postgres (negotiation state) · [Exa](https://exa.ai) (counterparty research) · MCP ([SDK](https://github.com/modelcontextprotocol/typescript-sdk)) — built at the Neon Personal Agents Hackathon.

## License

MIT
