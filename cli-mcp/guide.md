# Codex CLI + MCP Field Guide

This is the plain-text companion to the visual guide at `/cli-mcp/`. It is intended for agents, crawlers, screen readers, and anyone who prefers concise Markdown.

## The one thing to copy

Paste this prompt into Codex CLI, the desktop app, or the IDE extension. Replace only the final goal.

```text
First, orient yourself: read the project instructions and relevant files, then briefly explain your understanding.

Use the most appropriate tools available—including local project tools, web search, and connected MCP servers—when they improve accuracy or save manual work. Ask before any consequential or hard-to-reverse action.

Complete the goal, verify the result with the relevant checks, and finish with a concise summary of what changed and any decisions I still need to make.

My goal: [REPLACE THIS WITH YOUR GOAL]
```

This prompt activates a repeatable workflow: orient, choose tools, work, verify, and report. It does not grant access to an external service. Configure each MCP connection once; Codex can then choose it when relevant.

## CLI quickstart

1. Install Codex on macOS or Linux: `curl -fsSL https://chatgpt.com/codex/install.sh | sh`
2. Open the project: `cd ~/projects/my-app`
3. Launch the interactive terminal UI: `codex`
4. Paste the universal starter prompt and replace its final line.
5. Review the result and run `/review` for a focused review pass.

## MCP in plain language

Model Context Protocol (MCP) lets Codex use tools and context exposed by an MCP server. Local Codex clients on the same host share MCP configuration, so CLI, desktop, and IDE setup does not need to be repeated.

Add the Context7 documentation server:

```sh
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

Confirm configured servers with `codex mcp list`. Inside an interactive session, use `/mcp` to inspect active connections. For an OAuth server, run `codex mcp login <server-name>`.

## Useful commands

- `codex` — start an interactive session.
- `codex resume` — resume a saved session.
- `codex exec "your task"` — run a non-interactive task.
- `/status` — see current session settings.
- `/review` — review current changes.
- `codex mcp list` — list configured MCP servers.
- `/mcp` — inspect active MCP connections.
- `codex mcp --help` — see every MCP subcommand.

## Safety defaults

- Start external connections read-only.
- Keep secrets out of prompts; use environment variables or supported authentication flows.
- Enable only the tools the workflow needs.
- Keep human approval for writes, messages, deployments, and hard-to-reverse actions.

## Official references

- [Codex CLI command reference](https://learn.chatgpt.com/docs/developer-commands.md?surface=cli)
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp.md)
- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md)
