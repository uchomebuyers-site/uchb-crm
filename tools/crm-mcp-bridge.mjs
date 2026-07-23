#!/usr/bin/env node
// Local stdio <-> HTTP bridge for Claude Desktop's MCP support.
//
// crm-mcp (the Supabase Edge Function) already speaks full MCP over HTTP —
// this script does no protocol work of its own, it just relays each
// newline-delimited JSON-RPC message Claude Desktop sends on stdin to that
// endpoint, and writes the response back on stdout. Local MCP servers are
// trusted implicitly by Claude Desktop (no OAuth), which is the whole
// reason this exists — the browser/claude.ai "remote connector" path hit a
// hard OAuth requirement that a bare bearer-token URL can't satisfy.

import readline from 'node:readline'

const ENDPOINT = process.env.CRM_MCP_URL

if (!ENDPOINT) {
  process.stderr.write('crm-mcp-bridge: CRM_MCP_URL environment variable is not set\n')
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })

rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: trimmed,
    })

    // Notifications (no "id" in the request) get an empty 202 back —
    // nothing to relay, the caller isn't waiting for a reply.
    if (res.status === 202) return

    const text = (await res.text()).trim()
    if (text) process.stdout.write(text + '\n')
  } catch (err) {
    let requestId = null
    try {
      requestId = JSON.parse(trimmed).id ?? null
    } catch {
      // ignore — malformed input, fall through with id: null
    }
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        error: { code: -32603, message: `crm-mcp-bridge: ${err instanceof Error ? err.message : String(err)}` },
      }) + '\n',
    )
  }
})
