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

Tools: `read_content`, `edit_draft`, `preview_diff`, `list_assets`, `create_asset_upload`, `get_asset_download`, `extract_archive`, `get_archive_job`, `test_grader`, `get_grader_test`, `cancel_grader_test`, and `publish`. Large uploads/downloads use expiring scoped URLs. Private grader assets stay private. Runtime profiles are approved by the platform; no tool can select an arbitrary container image, promote a role, run shell commands, or access the database.

## Authentication

The server advertises OAuth protected-resource metadata and authorization-server discovery, registers public PKCE clients, requires scoped consent, validates the token audience, and rechecks application instructor access on each tool operation. Use the login command again if credentials expire. Do not paste access tokens into prompts or source files.

## License

MIT; see [LICENSE](LICENSE).

## Rollout status

The platform and MCP endpoint are live at https://uas.seas.ucla.edu/workshops/. Sign in with Google or GitHub first; an SSH maintenance operator must promote your explicitly identified account to instructor before agent editing is authorized. New accounts are pending by default.

## Projects and grading

Projects are attached to workshops. Instructor Studio presents Details, Data, and Submission on one page; the student site uses Overview, Data, Submit, Leaderboard, and My submissions. Project instructions and rules share one Markdown document.

Public file references specify their paths under `/data/`. Private test data and `grader.py` stay separate. Student scripts/notebooks generate an artifact beneath `/output/`; a separate isolated Python grader calls `grade(submission_path, test_data_dir)` and returns finite numeric metrics. One explicit metric and direction determines leaderboard order.

New or changed grading configurations need a passing `test_grader` example-artifact run before publication. Optional full-pipeline tests use a script/notebook. Tests consume no student quota. The same publication checks apply to website and agent edits. See [the editing skill](skills/uas-workshops/SKILL.md) for draft fields and test calls.
