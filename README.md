# context-passport

**Your context. Your rules. Any AI.**

A portable, user-owned context layer for AI. Your preferences, facts, and constraints travel with you across ChatGPT, Claude, Cursor, phones, and whatever comes next.

## The Problem

Every AI company is building memory into their assistant. But it's siloed:

- ChatGPT remembers you → locked inside OpenAI
- Claude remembers you → locked inside Anthropic
- Copilot remembers you → locked inside Microsoft

You have no portable identity across any of them. Every tool switch = start from zero. Your context is their moat.

## The Fix

`context-passport` is an open MCP server that holds your context in a file **you own**, and exposes it to any MCP-enabled AI — desktop or mobile.

### Core Principles

1. **User-owned** — the store lives on your machine (`~/.context-passport/store.json`)
2. **Declared vs Inferred** — what you say is authoritative; what a model guesses is marked, timestamped, and expires
3. **Revocable** — tombstones propagate; "forget this" actually means forget
4. **Scoped** — read vs readwrite grants per key
5. **Portable** — one JSON file, importable anywhere
6. **Two transports** — stdio for desktop, HTTP for mobile and remote

### Why the store lives outside the repo

`~/.context-passport/store.json` is deliberately **not** part of the git repo. Your context is personal data, not source code. The repo is the protocol the store is yours. This also means the passport travels with your machine, not with any project, and won't accidentally get committed or shared.

## See It Work

One command proves all four tools end-to-end:

```bash
npm install
node demo.js
