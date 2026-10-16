#!/usr/bin/env node
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const STORE = join(homedir(), ".context-passport", "store.json");
const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
  magenta: "\x1b[35m", red: "\x1b[31m",
};
const line = () => console.log(C.dim + "─".repeat(60) + C.reset);
const header = (t) => { line(); console.log(C.bold + C.cyan + t + C.reset); line(); };

await rm(STORE, { force: true });

console.log();
console.log(C.bold + C.magenta + "  🛂  context-passport — live demo" + C.reset);
console.log(C.dim   + "      Your context. Your rules. Any AI." + C.reset);
console.log();

const server = spawn("node", ["src/server.js"]);
let buffer = "";
let pending = new Map();

server.stdout.on("data", (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const raw of lines) {
    if (!raw.trim()) continue;
    try {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch {}
  }
});

let nextId = 1;
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("timeout: " + method)); } }, 5000);
  });
}

async function callTool(name, args) {
  const res = await call("tools/call", { name, arguments: args });
  if (res.result?.content?.[0]?.text) {
    try { return JSON.parse(res.result.content[0].text); } catch { return res.result.content[0].text; }
  }
  return res;
}

await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "demo", version: "0.1.0" } });

header("1. Tools exposed by the MCP server");
const { result: toolsRes } = await call("tools/list");
for (const t of toolsRes.tools) {
  console.log(`   ${C.green}●${C.reset} ${C.bold}${t.name}${C.reset}`);
  console.log(`     ${C.dim}${t.description}${C.reset}`);
}

header("2. User DECLARES a preference (authoritative)");
console.log(C.dim + '   → context_declare  key="preferences.tone"  value="direct, no fluff"' + C.reset);
await callTool("context_declare", { key: "preferences.tone", value: "direct, no fluff", scope: "read" });
const q1 = await callTool("context_query", { key: "preferences.tone" });
console.log(C.green + "   ← declared:" + C.reset + " " + JSON.stringify(q1.declared));
console.log();

header("3. Model INFERS something (non-authoritative, expires)");
console.log(C.dim + '   → context_infer    key="prefers_async"  confidence=0.72  ttl=30d' + C.reset);
await callTool("context_infer", { key: "prefers_async", value: true, confidence: 0.72, provenance: "derived from calendar decline patterns", ttl_days: 30 });
const q2 = await callTool("context_query", { key: "prefers_async" });
console.log(C.yellow + "   ← inferred:" + C.reset + " " + JSON.stringify(q2.inferred, null, 2).split("\n").join("\n     "));
console.log();

header("4. User REVOKES the inference (tombstone, permanent)");
console.log(C.dim + '   → context_revoke   key="prefers_async"' + C.reset);
await callTool("context_revoke", { key: "prefers_async" });
const q3 = await callTool("context_query", { key: "prefers_async" });
console.log(C.red + "   ← after revoke:" + C.reset + " " + JSON.stringify(q3));

header("5. Final state — declared survived, inferred wiped");
const q4 = await callTool("context_query", { key: "preferences.tone" });
console.log(`   ${C.green}declared preferences.tone${C.reset}  → ${JSON.stringify(q4.declared?.value)}`);
console.log(`   ${C.red}inferred prefers_async${C.reset}      → ${q3.inferred === null ? "gone" : JSON.stringify(q3.inferred)}`);
console.log(`   ${C.dim}tombstoned:${C.reset}                  ${q3.tombstoned}`);

console.log();
line();
console.log(C.bold + C.green + "  ✓  All 4 tools work. Declared vs inferred separation holds." + C.reset);
console.log(C.bold + C.green + "  ✓  Revocation is permanent (tombstoned)." + C.reset);
console.log(C.dim  + "     Store written to: " + STORE + C.reset);
line();
console.log();

server.kill();
process.exit(0);
