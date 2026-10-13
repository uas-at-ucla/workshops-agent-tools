# UAS Workshops agent tools

Instructor editing for [UAS@UCLA Workshops](https://uas.seas.ucla.edu/workshops/). This repository contains the shared editing skill and Claude Code plugin. It contains no credentials, student records, datasets, or hidden grading assets.

The MCP endpoint is `https://uas.seas.ucla.edu/workshops/mcp`. Sign in using an instructor account when OAuth opens. Register on the workshop site first; instructor promotion is performed through SSH maintenance. Students and pending accounts cannot use editing tools.

## Installation

### Claude Code

```bash
claude plugin marketplace add uas-at-ucla/workshops-agent-tools
claude plugin install uas-workshops@uas-workshops
```

Run `/reload-plugins` inside Claude Code after installation. The plugin bundles both the skill and MCP configuration; no separate skills or MCP registration command is needed. Authorize OAuth when the first tool is used. See [Claude plugin installation](https://code.claude.com/docs/en/discover-plugins) and [MCP authentication](https://code.claude.com/docs/en/mcp).

### Shared skill for Codex, Pi, and OpenCode

```bash
npx -y skills add uas-at-ucla/workshops-agent-tools --skill uas-workshops --yes --global
```

### Codex

```bash
codex mcp add uas-workshops --url https://uas.seas.ucla.edu/workshops/mcp
codex mcp login uas-workshops
```

Restart/reload your agent session after installing the skill. See [official Codex MCP instructions](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

### Pi

```bash
pi mcp add uas-workshops --url https://uas.seas.ucla.edu/workshops/mcp
pi mcp login uas-workshops
```

Use `/reload` after changing configuration outside the current Pi session. See [official Pi MCP instructions](https://pi.dev/docs/latest/mcp).

### OpenCode

Add under `"mcp"` in `~/.config/opencode/opencode.jsonc`:

```json
"uas-workshops": {
  "type": "remote",
  "url": "https://uas.seas.ucla.edu/workshops/mcp",
  "enabled": true,
  "oauth": {}
}
```

Then run:

```bash
opencode mcp auth uas-workshops
```

See [official OpenCode MCP instructions](https://opencode.ai/docs/mcp-servers/).

## Editing workflow

Read the shared draft and published content, edit the draft at the revision you read, then preview the differences. Publish only when explicitly requested. A stale publication rejects the request and requires a new preview. The instructor studio's **Copy agent prompt** button includes the selected context and setup instructions.

Tools: `read_content`, `edit_draft`, `preview_diff`, `list_assets`, `create_asset_upload`, `get_asset_download`, and `publish`. Large uploads/downloads use expiring scoped URLs. Private grader assets stay private. Runtime profiles are approved by the platform; no tool can select an arbitrary container image, promote a role, run shell commands, or access the database.

## Authentication

The server advertises OAuth protected-resource metadata and authorization-server discovery, registers public PKCE clients, requires scoped consent, validates the token audience, and rechecks application instructor access on each tool operation. Use the login command again if credentials expire. Do not paste access tokens into prompts or source files.

## License

MIT; see [LICENSE](LICENSE).

## Rollout status

The platform is staged privately. Public MCP sign-in becomes available after the workshop application's rollout completes. During staging, the public endpoint may return 404. Installation can be prepared now; OAuth needs the live endpoint and a promoted instructor account.
