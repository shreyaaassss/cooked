#!/usr/bin/env node

/**
 * swiggy-mcp-runner.mjs
 *
 * Equivalent of zepto-mcp-runner.mjs for Swiggy Instamart.
 * Spawns a single mcp-remote process, initializes the MCP handshake,
 * then runs one or more tool calls sequentially over that connection.
 *
 * Usage:
 *   node swiggy-mcp-runner.mjs [--compact] <tool-name> [json-args]
 *   node swiggy-mcp-runner.mjs --list-tools
 *   node swiggy-mcp-runner.mjs [--compact] --batch-json '<json-array>'
 *   node swiggy-mcp-runner.mjs [--compact] --batch <json-file|->
 *   node swiggy-mcp-runner.mjs --endpoint <url> [--compact] <tool-name> [json-args]
 *
 * Supported Swiggy endpoints:
 *   instamart  https://mcp.swiggy.com/im      (default)
 *   food       https://mcp.swiggy.com/food
 *   dineout    https://mcp.swiggy.com/dineout
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const ENDPOINTS = {
  instamart: "https://mcp.swiggy.com/im",
  food: "https://mcp.swiggy.com/food",
  dineout: "https://mcp.swiggy.com/dineout",
};

const DEFAULT_ENDPOINT = ENDPOINTS.instamart;

function usage() {
  console.error(`Usage:
  swiggy-mcp-runner.mjs [--compact] [--endpoint <url|instamart|food|dineout>] <tool-name> [json-args]
  swiggy-mcp-runner.mjs --list-tools [--endpoint <url|name>]
  swiggy-mcp-runner.mjs [--compact] --batch <json-file|->
  swiggy-mcp-runner.mjs [--compact] --batch-json '<json-array>'

Batch JSON shape:
  [
    {"name":"get_addresses","arguments":{}},
    {"name":"search_products","arguments":{"query":"chicken"}}
  ]

--compact  removes image URLs and trims verbose output for faster agent parsing.
--endpoint choose which Swiggy MCP to connect to (default: instamart).
`);
}

// ── npx discovery (same logic as zepto-mcp-runner) ──

function isExecutable(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function nvmBins() {
  const root = join(homedir(), ".nvm", "versions", "node");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((v) => v.startsWith("v"))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map((v) => join(root, v, "bin"));
}

function candidateBins() {
  return unique([
    ...nvmBins(),
    join(homedir(), ".npm-global", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/Applications/Codex.app/Contents/Resources",
    ...(process.env.PATH || "").split(process.platform === "win32" ? ";" : ":"),
  ]);
}

function resolveExecutable(name, envVar) {
  const explicit = process.env[envVar];
  if (explicit) {
    if (isExecutable(explicit)) return explicit;
    throw new Error(`${envVar} is set but not executable: ${explicit}`);
  }
  // On Windows also look for .cmd / .exe variants
  const suffixes = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  for (const bin of candidateBins()) {
    for (const suffix of suffixes) {
      const candidate = join(bin, name + suffix);
      if (isExecutable(candidate)) return candidate;
    }
  }
  throw new Error(
    `Could not find ${name}. Checked PATH, NVM, ~/.npm-global/bin, Homebrew. ` +
      `Set ${envVar}=/absolute/path/to/${name} if it is installed elsewhere.`
  );
}

// ── MCP result parsing ──

function parseToolResult(result) {
  if (result?.structuredContent) return result.structuredContent;

  const text = (result?.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");

  if (!text) return result ?? null;

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

// ── Compact output (strip images, trim long lists) ──

function compactLimit(envName, fallback) {
  const value = Number(process.env[envName] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function compactValue(value, toolName) {
  if (Array.isArray(value)) {
    return value.map((item) => compactValue(item, toolName));
  }
  if (!value || typeof value !== "object") return value;

  const productLimit = compactLimit("SWIGGY_COMPACT_PRODUCT_LIMIT", 6);
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    // Strip image fields
    if (
      key === "imageUrl" ||
      key === "images" ||
      key === "media" ||
      key === "image" ||
      key === "cloudinaryImageId" ||
      key === "logo"
    )
      continue;
    // Trim product arrays
    if (key === "products" && Array.isArray(child)) {
      output[key] = child
        .slice(0, productLimit)
        .map((item) => compactValue(item, toolName));
      if (child.length > productLimit)
        output.productsOmitted = child.length - productLimit;
      continue;
    }
    if (key === "items" && Array.isArray(child) && child.length > productLimit) {
      output[key] = child
        .slice(0, productLimit)
        .map((item) => compactValue(item, toolName));
      if (child.length > productLimit)
        output.itemsOmitted = child.length - productLimit;
      continue;
    }
    output[key] = compactValue(child, toolName);
  }
  return output;
}

function compactToolResult(toolName, result) {
  return compactValue(result, toolName);
}

// ── stdin / batch helpers ──

async function readStdin() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

function parseBatchJson(text, source) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Could not parse ${source} as JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON array of tool calls.`);
  }
  return parsed;
}

// ── MCP Client (spawns mcp-remote, handles JSON-RPC over stdio) ──

class McpClient {
  constructor(endpoint) {
    const npx = resolveExecutable("npx", "SWIGGY_NPX_PATH");
    const npxBin = dirname(npx);
    this.child = spawn(npx, ["--yes", "mcp-remote", endpoint], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${npxBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}`,
        NPM_CONFIG_PREFIX:
          process.env.NPM_CONFIG_PREFIX || join(homedir(), ".npm-global"),
      },
    });
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.child.stderr.on("data", (chunk) => {
      // Suppress noisy mcp-remote / npm log lines
      if (
        !/npm warn|Local.STDIO|Proxy established|Press Ctrl|Remote.Local|Local.Remote|Connected|Discovering|Discovered|Using transport|Connecting|Shutting down/.test(
          chunk
        )
      ) {
        process.stderr.write(chunk);
      }
    });
    this.child.on("exit", (code, signal) => {
      for (const { reject } of this.pending.values()) {
        reject(
          new Error(
            `mcp-remote exited before response (code=${code}, signal=${signal})`
          )
        );
      }
      this.pending.clear();
    });
  }

  handleStdout(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.startsWith("{")) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timeout } = this.pending.get(message.id);
        clearTimeout(timeout);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    }
  }

  request(method, params, timeoutMs = 30000) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    return promise;
  }

  notify(method, params) {
    this.child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`
    );
  }

  async init() {
    // Brief pause for mcp-remote to start up
    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "cookcart-swiggy-runner", version: "0.1.0" },
    });
    this.notify("notifications/initialized", {});
  }

  async callTool(name, args = {}) {
    const result = await this.request(
      "tools/call",
      { name, arguments: args },
      60000
    );
    return parseToolResult(result);
  }

  async listTools() {
    const result = await this.request("tools/list", {}, 60000);
    return (result.tools ?? []).map((tool) => ({
      name: tool.name,
      required: tool.inputSchema?.required ?? [],
      properties: Object.keys(tool.inputSchema?.properties ?? {}),
    }));
  }

  close() {
    this.child.kill("SIGINT");
  }
}

// ── CLI entry point ──

async function main() {
  const rawArgs = process.argv.slice(2);

  // Extract --endpoint flag
  let endpoint = DEFAULT_ENDPOINT;
  const filteredArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === "--endpoint" && i + 1 < rawArgs.length) {
      const val = rawArgs[i + 1];
      endpoint = ENDPOINTS[val] || val; // allow alias or raw URL
      i++; // skip next
    } else {
      filteredArgs.push(rawArgs[i]);
    }
  }

  const compact = filteredArgs.includes("--compact");
  const positional = filteredArgs.filter((arg) => arg !== "--compact");
  const [first, second] = positional;

  if (!first) {
    usage();
    process.exit(2);
  }

  let calls;
  const listTools = first === "--list-tools";

  if (first === "--batch") {
    if (!second) {
      usage();
      process.exit(2);
    }
    const batchText =
      second === "-" ? await readStdin() : await readFile(second, "utf8");
    calls = parseBatchJson(batchText, second === "-" ? "stdin batch" : second);
  } else if (first === "--batch-json") {
    if (!second) {
      usage();
      process.exit(2);
    }
    calls = parseBatchJson(second, "--batch-json");
  } else if (listTools) {
    calls = [];
  } else {
    calls = [{ name: first, arguments: second ? JSON.parse(second) : {} }];
  }

  const client = new McpClient(endpoint);
  try {
    await client.init();
    if (listTools) {
      console.log(JSON.stringify(await client.listTools(), null, 2));
      return;
    }

    const results = [];
    for (const call of calls) {
      const result = await client.callTool(call.name, call.arguments ?? {});
      results.push({
        name: call.name,
        result: compact ? compactToolResult(call.name, result) : result,
      });
    }
    console.log(
      JSON.stringify(
        results.length === 1 ? results[0].result : results,
        null,
        2
      )
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
