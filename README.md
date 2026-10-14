# UAS Workshops agent tools

Instructor editing for [UAS@UCLA Workshops](https://uas.seas.ucla.edu/workshops/). This repository contains the shared editing skill and Claude Code plugin. It contains no credentials, student records, datasets, or hidden grading assets.

The MCP endpoint is `https://uas.seas.ucla.edu/workshops/mcp`. Sign in using an instructor account when OAuth opens. Register on the workshop site first; instructor promotion is performed through SSH maintenance. Students and pending accounts cannot use editing tools.

## Let the agent connect itself

Give your agent this one line, or use **Copy agent prompt** in Instructor Studio:

> Fetch and follow instructions: https://uas.seas.ucla.edu/workshops/agent.txt

Claude Code, Codex, Pi and OpenCode add the workshop MCP server to themselves and open the sign-in page. Sign in with your instructor Google or GitHub account and approve access, then start a new session (Pi: `/reload`) and send the same line again. That is needed once per machine; afterwards the tools are simply there.

Any other agent that can run shell commands (Node 18+) uses the helper in this repository instead, which needs no new session.

## Set it up yourself

The commands the instructions give each agent. Each opens the sign-in page.

### Claude Code

```bash
claude mcp add --transport http --scope user uas-workshops https://uas.seas.ucla.edu/workshops/mcp
claude mcp login uas-workshops
```

Older versions have no `mcp login`: type `/mcp` in a session and choose `uas-workshops`. This repository is also a Claude Code plugin (`claude plugin marketplace add uas-at-ucla/workshops-agent-tools`, then `claude plugin install uas-workshops@uas-workshops`) if you prefer that route.

### Codex

```bash
codex mcp add uas-workshops --url https://uas.seas.ucla.edu/workshops/mcp
```

Adding the server starts the sign-in. `codex mcp login uas-workshops` signs in again later.

### Pi

```bash
pi mcp add uas-workshops --url https://uas.seas.ucla.edu/workshops/mcp
pi mcp login uas-workshops
```

Run `/reload` in an open session.

### OpenCode

Add under `"mcp"` in `~/.config/opencode/opencode.json`:

```json
"uas-workshops": {
  "type": "remote",
  "url": "https://uas.seas.ucla.edu/workshops/mcp",
  "enabled": true,
  "oauth": {}
}
```

```bash
opencode mcp auth uas-workshops
```

OpenCode waits five minutes for the sign-in. Under WSL with a Windows browser, the final page may fail to load at `http://127.0.0.1:19876/...`; change `127.0.0.1` to `localhost` in the address bar and press Enter.

### Any other agent: the helper

`npx -y github:uas-at-ucla/workshops-agent-tools <command>` signs in through the browser and calls the same tools over the same endpoint:

| Command | What it does |
| --- | --- |
| `login` | Opens the sign-in page, prints the link, returns immediately |
| `wait` | Blocks until the instructor has signed in |
| `status` | Shows whether this machine is signed in |
| `tools` | Lists the tools and their arguments |
| `call <tool> [args]` | Calls a tool; arguments are JSON, `@file.json`, or `-` for stdin |
| `guide` | Prints the instructions agents follow |
| `logout` | Forgets the sign-in on this machine and ends it at the workshop server |

The helper stores its sign-in in `~/.config/uas-workshops/credentials.json`, readable only by your user, and never prints it. If the browser is on a different machine from the agent, the final page will not load: give the agent that page's address and it finishes with `login --callback-url`.

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
