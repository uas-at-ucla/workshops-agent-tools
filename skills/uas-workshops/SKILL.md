---
name: uas-workshops
description: Edit UAS@UCLA workshop schedules, materials, projects, assets, and grading configurations using its instructor-authorized MCP server. Use for UAS workshop content changes; not server maintenance or instructor promotion.
---

# UAS workshop editing

Connect to the `uas-workshops` MCP server at `https://uas.seas.ucla.edu/workshops/mcp`. Authorize the instructor's Google/GitHub account when the agent requests OAuth. The application checks the instructor role on every tool operation; a pending or student account cannot edit content.

Start with `read_content`. Find the selected workshop/project by its stable ID, preserve unrelated content, and use `edit_draft` with the revision returned by the read. Workshop dates include a Pacific UTC offset (`-07:00` during daylight time, `-08:00` during standard time). Keep existing slide and attendance links unless asked to change them.

Draft updates synchronize with the instructor studio and autosave. They do not change the published student site. After editing, use `preview_diff` to inspect the resulting draft against published content. Call `publish` only when the instructor explicitly requests publication. Supply the revision reviewed; on a stale-revision rejection, read again, reconcile the changes, and preview again before retrying.

Use `list_assets` to find existing immutable assets. For new files, `create_asset_upload` returns a single-use HTTPS PUT URL, an asset ID, and the size/expiration limits. Upload the bytes as `application/octet-stream`, then reference the asset ID in the draft. Use `get_asset_download` for a short-lived scoped download URL. Never include these grant URLs or access tokens in source or publicly shared instructions.

Classify starters/resources as `public`, mounted student inputs as `dataset`, and hidden labels/test expectations as `private`. Private assets must never appear in project downloads or mounted datasets. Student runtime profiles are restricted to CPU Python, CUDA/PyTorch, and headless ROS2. Grading changes create a new immutable grading version and leaderboard; description-only changes retain the current grading version. Archive projects/workshops to preserve submission history.

There are no role-promotion, shell, or database tools. Student approvals are managed by the instructor studio. Instructor promotion requires an SSH maintenance operator and an explicitly identified account. Do not attempt to bypass these limits.
