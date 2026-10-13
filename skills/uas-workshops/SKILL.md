---
name: uas-workshops
description: Edit UAS@UCLA workshop schedules, materials, projects, assets, and grading configurations using its instructor-authorized MCP server. Use for UAS workshop content changes; not server maintenance or instructor promotion.
---

# UAS workshop editing

## Connecting

Connect yourself. Do not ask the instructor to install or configure anything; the only thing they do is sign in.

1. If tools from the `uas-workshops` MCP server (`read_content`, `edit_draft`, and so on) are already available in this session, use them directly.
2. Otherwise use the helper bundled with this skill, `scripts/uas-workshops.mjs` (Node 18+, no dependencies). Without the skill folder, the same helper runs as `npx -y github:uas-at-ucla/workshops-agent-tools <command>`.
   - `node scripts/uas-workshops.mjs status` exits 0 when this machine is already signed in.
   - `node scripts/uas-workshops.mjs login` opens the workshop sign-in page in the instructor's browser, prints the same link, and returns immediately. Tell the instructor that a sign-in page has opened and that they should sign in with their instructor Google or GitHub account and approve access. Show them the link in case the browser did not open.
   - `node scripts/uas-workshops.mjs wait` blocks until they have signed in (exit 2 means still waiting; run it again). If their browser is on another machine and ends on a page that cannot load, ask for that page's address and run `login --callback-url '<address>'`.
   - `node scripts/uas-workshops.mjs call <tool> '<json arguments>'` calls a tool and prints its JSON result. Pass large arguments as `@file.json` or `-` for stdin. `tools` lists every tool with its arguments.
3. When a call reports that the sign-in expired, run `login` and `wait` again.

The helper keeps its sign-in in a private file under `~/.config/uas-workshops/`. Never read, print, or copy that file or any token. The application checks the instructor role on every tool operation; a pending or student account cannot edit content, and the helper says so if the wrong account signs in.

The native MCP endpoint is `https://uas.seas.ucla.edu/workshops/mcp` for clients that are configured for it. Both routes reach the same tools with the same checks.

## Editing

Start with `read_content`. Find the selected workshop/project by its stable ID, preserve unrelated content, and use `edit_draft` with the revision returned by the read. Workshop dates include a Pacific UTC offset (`-07:00` during daylight time, `-08:00` during standard time). Keep existing slide and attendance links unless asked to change them.

Draft updates synchronize with the instructor studio and autosave. They do not change the published student site. After editing, use `preview_diff` to inspect the resulting draft against published content. Call `publish` only when the instructor explicitly requests publication. Supply the revision reviewed; on a stale-revision rejection, read again, reconcile the changes, and preview again before retrying.

Use `list_assets` to find existing immutable assets. For new files, `create_asset_upload` returns a single-use HTTPS PUT URL, an asset ID, and the size/expiration limits. Upload the bytes as `application/octet-stream`, then reference the asset ID in the draft. Use `get_asset_download` for a short-lived scoped download URL. Never include these grant URLs or access tokens in source or publicly shared instructions.

Projects belong to a workshop (`workshopId`). Use one Markdown `description` for overview, provided files, execution instructions, artifact format, evaluation, and rules/terms; leave legacy `rules` empty. Classify all public inputs/starters as `public` (legacy `dataset` is also supported), and evaluation datasets, grader scripts, and test samples as `private`. Each download has an immutable `assetId`, a relative `path` beneath `/data/`, and an optional description. Use `extract_archive` to process ZIP/tar datasets, then poll `get_archive_job`; preserve the returned folders when attaching the classified assets. The server rejects unsafe archives and never recursively extracts nested archives. Private assets must never appear in project downloads or mounted datasets. New projects use `grader.adapter: "artifact-python"`. Set `graderAssetId` to private `grader.py`, `privateFiles` to `{assetId, path, description}` references beneath `/test_data/`, and `artifactPath` to the student output relative to `/output/` (default `submission.csv`). The grader defines `grade(submission_path: str, test_data_dir: str) -> dict[str, float]`. Set exactly one primary `metric` key and `direction` (`higher` maximizes; `lower` minimizes). Every returned metric must be finite numeric data, and the primary key must exist. Student code cannot see evaluation files or grader code.

Choose student `profile` and private `graderProfile` independently from `cpu-python`, `cuda-pytorch`, and `ros2`; both default to CPU. `runtimeSeconds` is a combined deadline, default 600 and maximum 3600. Do not upload requirements or select arbitrary images.

After a grading change, upload a private example artifact, call `test_grader` with `{projectId, expectedRevision, sampleAssetId, mode: "grader"}`, and poll `get_grader_test`. A passing **current example-artifact test** is required before publishing. Use `mode: "pipeline"` with a private `.py`/`.ipynb` sample for an optional full-pipeline test. Tests do not consume student quota or cooldown. Grading edits make old test results outdated; title, Markdown, and file-description edits retain validity. Keep incomplete projects unpublished so they do not block other updates. Grading changes create a new immutable grading version and leaderboard; description-only changes retain the current grading version. Archive projects/workshops to preserve submission history.

There are no role-promotion, shell, or database tools. Student approvals are managed by the instructor studio. Instructor promotion requires an SSH maintenance operator and an explicitly identified account. Do not attempt to bypass these limits.
