// PostToolUseFailure hook: when a remote MCP call fails with a connection or sign-in error,
// ask isitme whether the server is down, needs sign-in or works fine, and hand the answer to the agent.
// Sends only the server's URL, and never one that may carry a key (query, fragment, credentials, token-like path segment).
// Same rule as secretish() in the isitme server's src/probe.ts; change both together.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://isitme.menloparklabai.workers.dev/v1/check";
const TRANSPORT_ERROR = /connect|ECONN|ENOTFOUND|timed? ?out|fetch failed|network|socket|session|unauthori[sz]ed|forbidden|\b40[13]\b|\b5\d\d\b|oauth|token|sign.?in|re-?auth|unavailable|refused/i;

const norm = (s) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
};

function serverUrl(server, cwd) {
  const user = readJson(join(homedir(), ".claude.json"));
  const scopes = [readJson(join(cwd, ".mcp.json")).mcpServers, user.projects?.[cwd]?.mcpServers, user.mcpServers];
  for (const servers of scopes)
    for (const [name, cfg] of Object.entries(servers ?? {})) if (norm(name) === server && /^https:\/\//.test(cfg?.url ?? "")) return cfg.url;
  return null;
}

function secretish(raw) {
  const u = new URL(raw);
  return !!(u.search || u.hash || u.username || u.password || u.pathname.split("/").some((s) => (s.length >= 16 && /\d/.test(s)) || s.length >= 32));
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const server = input.mcp_server?.name ? norm(input.mcp_server.name) : input.tool_name?.match(/^mcp__(.+?)__/)?.[1];
  if (!server || !TRANSPORT_ERROR.test(String(input.error ?? ""))) return;
  const url = input.mcp_server?.url ?? serverUrl(server, input.cwd ?? process.cwd());
  if (!url || secretish(url)) return;

  const res = await fetch(`${API}?url=${encodeURIComponent(url)}&reason=failure`, {
    headers: { "user-agent": "isitme-hook/0.2 (claude-code)", ...(process.env.ISITME_SMOKE ? { "x-studio-smoke": "1" } : {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return;
  const r = await res.json();
  const context = [
    `isitme checked ${url} after this failure: likely cause "${r.likely_cause}" (server status ${r.probe?.status}${r.probe?.auth_mode ? `, auth ${r.probe.auth_mode}` : ""}, probed ${r.probe?.checked_at}).`,
    r.advice,
    r.check_id ? `If you retry, report whether it worked: POST https://isitme.menloparklabai.workers.dev/v1/outcome {"url": "${url}", "check_id": ${r.check_id}, "worked": true|false}` : "",
  ].filter(Boolean).join(" ");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUseFailure", additionalContext: context } }));
}

main().catch(() => {});
