#!/usr/bin/env node
import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, handleTool } from "./tools.js";

const PORT = Number(process.env.CP_HTTP_PORT ?? 3000);
const HOST = process.env.CP_HTTP_HOST ?? "0.0.0.0";
const TOKEN = process.env.CP_HTTP_TOKEN ?? "";

function createMcpServer() {
  const server = new Server(
    { name: "context-passport-http", version: "0.2.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      return await handleTool(name, args);
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  });
  return server;
}

const httpServer = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "context-passport" }));
    return;
  }

  if (TOKEN) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
  }

  if (req.url?.startsWith("/mcp")) {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      mcpServer.close();
    });
    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("MCP request error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal error", message: err.message }));
      }
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found", hint: "MCP endpoint is /mcp" }));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`🛂  context-passport HTTP server`);
  console.log(`    Listening: http://${HOST}:${PORT}/mcp`);
  console.log(`    Health:    http://${HOST}:${PORT}/health`);
  console.log(`    Auth:      ${TOKEN ? "bearer token required" : "none (local only)"}`);
  if (HOST === "0.0.0.0") {
    console.log(`    ⚠  Bound to 0.0.0.0 — reachable on your local network.`);
    console.log(`       Do NOT expose to the internet without CP_HTTP_TOKEN set.`);
  }
});
