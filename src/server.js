#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readStore, writeStore, queryContext, declareFact, inferFact, revokeFact } from "./store.js";

const server = new Server(
  { name: "context-passport", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "context_query",
      description: "Query the user's portable context (declared and inferred).",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string", description: "Dot-path key, e.g. preferences.tone" } },
        required: ["key"],
      },
    },
    {
      name: "context_declare",
      description: "User explicitly declares a fact or preference. Authoritative.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: {},
          scope: { type: "string", enum: ["read", "readwrite"], default: "read" },
        },
        required: ["key", "value"],
      },
    },
    {
      name: "context_infer",
      description: "Model proposes an inference. Non-authoritative, expires.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: {},
          confidence: { type: "number" },
          provenance: { type: "string" },
          ttl_days: { type: "number", default: 30 },
        },
        required: ["key", "value", "confidence", "provenance"],
      },
    },
    {
      name: "context_revoke",
      description: "Revoke a declared or inferred fact. Tombstones it.",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case "context_query": {
        const store = await readStore();
        return { content: [{ type: "text", text: JSON.stringify(queryContext(store, args.key), null, 2) }] };
      }
      case "context_declare": {
        const store = await readStore();
        declareFact(store, args.key, args.value, args.scope ?? "read");
        await writeStore(store);
        return { content: [{ type: "text", text: `Declared: ${args.key}` }] };
      }
      case "context_infer": {
        const store = await readStore();
        inferFact(store, args.key, args.value, args.confidence, args.provenance, args.ttl_days ?? 30);
        await writeStore(store);
        return { content: [{ type: "text", text: `Inferred: ${args.key}` }] };
      }
      case "context_revoke": {
        const store = await readStore();
        revokeFact(store, args.key);
        await writeStore(store);
        return { content: [{ type: "text", text: `Revoked: ${args.key}` }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
