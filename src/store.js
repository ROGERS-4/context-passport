import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STORE_DIR = join(homedir(), ".context-passport");
const STORE_PATH = join(STORE_DIR, "store.json");

const EMPTY_STORE = {
  version: "0.1.0",
  user: { webid: "did:local:user", declared: {}, inferred: {} },
  tombstones: [],
};

export async function readStore() {
  if (!existsSync(STORE_PATH)) return structuredClone(EMPTY_STORE);
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return structuredClone(EMPTY_STORE);
  }
}

export async function writeStore(store) {
  if (!existsSync(STORE_DIR)) await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function queryContext(store, key) {
  const declared = lookup(store.user.declared, key);
  const inferred = lookup(store.user.inferred, key);
  const tombstoned = store.tombstones.some((t) => t.key === key);
  return { key, declared: declared ?? null, inferred: inferred ?? null, tombstoned };
}

function lookup(obj, key) {
  if (!obj) return undefined;
  if (obj[key] !== undefined) return obj[key];
  return dig(obj, key);
}

export function declareFact(store, key, value, scope = "read") {
  store.user.declared[key] = {
    value,
    scope,
    created: new Date().toISOString(),
    source: "user",
  };
  store.tombstones = store.tombstones.filter((t) => t.key !== key);
}

export function inferFact(store, key, value, confidence, provenance, ttlDays = 30) {
  const expires = new Date(Date.now() + ttlDays * 86400000).toISOString();
  store.user.inferred[key] = {
    value,
    confidence,
    provenance,
    expires,
    created: new Date().toISOString(),
    source: "model",
  };
}

export function revokeFact(store, key) {
  delete store.user.declared[key];
  delete store.user.inferred[key];
  if (!store.tombstones.some((t) => t.key === key)) {
    store.tombstones.push({ key, revoked_at: new Date().toISOString() });
  }
}

function dig(obj, path) {
  if (!obj) return undefined;
  return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}
