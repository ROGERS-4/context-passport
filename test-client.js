import { spawn } from "node:child_process";

const server = spawn("node", ["src/server.js"]);

let buffer = "";
server.stdout.on("data", (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.log("← SERVER:", JSON.stringify(msg, null, 2));
    } catch {}
  }
});

server.stderr.on("data", (d) => console.error("STDERR:", d.toString()));

function send(obj) {
  const payload = JSON.stringify(obj) + "\n";
  console.log("→ CLIENT:", JSON.stringify(obj));
  server.stdin.write(payload);
}

// 1. initialize handshake
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.1.0" },
  },
});

// 2. list tools
setTimeout(() => {
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}, 500);

// 3. declare a fact
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "context_declare",
      arguments: {
        key: "preferences.tone",
        value: "direct, no fluff",
        scope: "read",
      },
    },
  });
}, 1000);

// 4. query it back
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "context_query",
      arguments: { key: "preferences.tone" },
    },
  });
}, 1500);

// 5. infer something
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "context_infer",
      arguments: {
        key: "prefers_async",
        value: true,
        confidence: 0.72,
        provenance: "derived from test client",
        ttl_days: 30,
      },
    },
  });
}, 2000);

// 6. query the inference
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "context_query",
      arguments: { key: "prefers_async" },
    },
  });
}, 2500);

// 7. revoke it
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "context_revoke",
      arguments: { key: "prefers_async" },
    },
  });
}, 3000);

// 8. verify tombstone
setTimeout(() => {
  send({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "context_query",
      arguments: { key: "prefers_async" },
    },
  });
}, 3500);

setTimeout(() => {
  server.kill();
  process.exit(0);
}, 4500);
