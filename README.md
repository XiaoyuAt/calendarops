# CalendarOps

> **A personal agent with its own inbox that schedules your meetings end-to-end — research, propose, negotiate, book, brief you.**

Built at [Neon Build Personal Agents Hack](https://build-personal-agents.com) · SF · Oct 4, 2026

## Why

Scheduling eats 2–3 hours of every founder's week — proposal emails, counterproposals, reschedules, timezone math. CalendarOps closes the entire loop **hands-free**. You forward it one meeting request; from its own address (`calendarops@agentmail.to`) it researches the counterparty, proposes slots, adapts to counters, books the meeting — then drops a **meeting-prep brief in your inbox**: who they are, how to play it, how many rounds it took. You did nothing.

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

## The loop, fully automated

```
forward one email ──▶ 🔍 research (Exa) ──▶ 📧 propose slots (conflict-checked)
                        │                          │
                        ▼                          ▼
                  📋 prep brief ◀── 📅 book ◀── 🔁 counter? adapt & re-propose
                  (your inbox)      (hold)        └─ money mentioned? → hands to you
```

**Full autonomy, one exception:** if the thread turns to money or contracts (`$`, `invoice`, `payment`, `quote`, `NDA`…), CalendarOps hands it to you — scheduling is its job, deals are yours. Everything else — research, proposals, counters, reschedules (up to 2×), booking, briefing — runs with zero human input.

## Run

```bash
npm install
npm run demo          # full simulation: autonomous loop + prep brief + guardrail. Zero infra needed.
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
