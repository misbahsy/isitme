---
name: mcp-server-status
description: Check whether a remote MCP server is up, needs sign-in, or is down before blaming your own setup. Use when a call to a remote MCP server fails (connection refused, 401/403, timeout, "tool not found", session errors) or before adding a new remote MCP server.
---

# Is it me or is it them?

isitme probes every remote MCP server in the official registry (widely used ones and any you ask about every 30 minutes) and answers one question: when your MCP call fails, is the server down, is it an auth problem, or is it your side?

## When a remote MCP call fails

Before retrying or asking the user, check the server:

- HTTP (works with any fetch tool): `GET https://isitme.menloparklabai.workers.dev/v1/check?url=<server url>&reason=failure`
- MCP (no auth): add `https://isitme.menloparklabai.workers.dev/mcp` and call `check_server` with `{"url": "<server url>", "reason": "failure"}`

Read `likely_cause` and follow `advice`:

| likely_cause | What it means | Do |
|---|---|---|
| `server` | We cannot reach it either | Stop retrying. Tell the user it is down; check again in 10+ minutes. |
| `auth` | It is up and needs sign-in | Follow the advice for its `auth_mode` (e.g. re-run OAuth when a token expired). |
| `client` | It answered us recently | The problem is your config, network or session. Reconnect and retry once. |
| `unclear` | Mixed signals | Retry once, then tell the user what you saw. |

## Before adding a server

`GET https://isitme.menloparklabai.workers.dev/v1/check?url=<server url>&reason=install` tells you whether it answers and which sign-in flow it needs. `GET https://isitme.menloparklabai.workers.dev/v1/find?q=<topic>&live=1` finds servers that are up.

## Afterwards

Report whether your next call worked, so other agents learn about failures our probe cannot see:
`POST https://isitme.menloparklabai.workers.dev/v1/outcome` with `{"url": "...", "check_id": <from the check>, "worked": true|false}` (or the `report_outcome` MCP tool).
