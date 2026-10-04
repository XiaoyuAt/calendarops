#!/usr/bin/env node
// CalendarOps MCP Server — the same core, exposed as 5 MCP tools.
// Run: npx tsx mcp/server.ts   (add to any MCP client via stdio)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema, ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { negotiationCreate, negotiationPropose, negotiationPoll, negotiationSettle } from '../core/negotiation.js';
import { research } from '../core/research.js';

const SlotSchema = z.object({ start: z.string(), end: z.string(), tz: z.string().optional() });

const server = new Server(
  { name: 'calendarops', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'negotiation.create',
      description: 'Open a scheduling negotiation thread with a counterparty. Researches them first (Exa).',
      inputSchema: {
        type: 'object',
        properties: {
          counterparty_email: { type: 'string' },
          counterparty_name: { type: 'string' },
          constraints: { type: 'string', description: 'e.g. "mornings only, avoid Monday"' },
        },
        required: ['counterparty_email'],
      },
    },
    {
      name: 'negotiation.propose',
      description: 'Propose time slots over email. Rejects slots that conflict with existing holds.',
      inputSchema: {
        type: 'object',
        properties: {
          thread_id: { type: 'string' },
          slots: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' }, tz: { type: 'string' } }, required: ['start', 'end'] } },
        },
        required: ['thread_id', 'slots'],
      },
    },
    {
      name: 'negotiation.poll',
      description: 'Check inbound replies; runs escalation gates (money language, reschedule limit, 48h expiry).',
      inputSchema: {
        type: 'object',
        properties: {
          thread_id: { type: 'string' },
          inbound: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, text: { type: 'string' } }, required: ['from', 'text'] } },
        },
        required: ['thread_id'],
      },
    },
    {
      name: 'negotiation.settle',
      description: 'Settle on a slot: writes a TENTATIVE hold and confirms by email. Final calendar write stays with the human.',
      inputSchema: {
        type: 'object',
        properties: { thread_id: { type: 'string' }, slot: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' }, tz: { type: 'string' } }, required: ['start', 'end'] } },
        required: ['thread_id', 'slot'],
      },
    },
    {
      name: 'context.research',
      description: 'Look up a counterparty (Exa) and return a negotiation posture: accommodate | firm | neutral.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' }, email: { type: 'string' } },
        required: ['name'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case 'negotiation.create': {
        const a = z.object({ counterparty_email: z.string(), counterparty_name: z.string().optional(), constraints: z.string().optional() }).parse(args);
        const t = await negotiationCreate(a);
        return { content: [{ type: 'text', text: JSON.stringify(t, null, 2) }] };
      }
      case 'negotiation.propose': {
        const a = z.object({ thread_id: z.string(), slots: z.array(SlotSchema) }).parse(args);
        const r = await negotiationPropose(a.thread_id, a.slots);
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
      case 'negotiation.poll': {
        const a = z.object({ thread_id: z.string(), inbound: z.array(z.object({ from: z.string(), text: z.string(), received_at: z.string().optional() })).optional() }).parse(args);
        const r = await negotiationPoll(a.thread_id, a.inbound ?? []);
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
      case 'negotiation.settle': {
        const a = z.object({ thread_id: z.string(), slot: SlotSchema }).parse(args);
        const r = await negotiationSettle(a.thread_id, a.slot);
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
      case 'context.research': {
        const a = z.object({ name: z.string(), email: z.string().optional() }).parse(args);
        const r = await research(a.name, a.email);
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
      default:
        throw new Error(`unknown tool: ${name}`);
    }
  } catch (e: any) {
    return { content: [{ type: 'text', text: `error: ${e.message}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
console.error('CalendarOps MCP server running (stdio)');
