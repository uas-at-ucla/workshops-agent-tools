---
name: uas-workshops
description: Edit UAS@UCLA workshop schedules, materials, projects, assets, and grading configurations using its instructor-authorized MCP server. Use for UAS workshop content changes; not server maintenance or instructor promotion.
---

# UAS workshop editing

Connect to the `uas-workshops` MCP server at `https://uas.seas.ucla.edu/workshops/mcp`. Authorize the instructor's Google/GitHub account when the agent requests OAuth. The application checks the instructor role on every tool operation; a pending or student account cannot edit content.

Start with `read_content`. Find the selected workshop/project by its stable ID, preserve unrelated content, and use `edit_draft` with the revision returned by the read. Workshop dates include a Pacific UTC offset (`-07:00` during daylight time, `-08:00` during standard time). Keep existing slide and attendance links unless asked to change them.

Draft updates synchronize with the instructor studio and autosave. They do not change the published student site. After editing, use `preview_diff` to inspect the resulting draft against published content. Call `publish` only when the instructor explicitly requests publication. Supply the revision reviewed; on a stale-revision rejection, read again, reconcile the changes, and preview again before retrying.

Use `list_assets` to find existing immutable assets. For new files, `create_asset_upload` returns a single-use HTTPS PUT URL, an asset ID, and the size/expiration limits. Upload the bytes as `application/octet-stream`, then reference the asset ID in the draft. Use `get_asset_download` for a short-lived scoped download URL. Never include these grant URLs or access tokens in source or publicly shared instructions.

Projects belong to a workshop (`workshopId`). Use one Markdown `description` for overview, provided files, execution instructions, artifact format, evaluation, and rules/terms; leave legacy `rules` empty. Classify all public inputs/starters as `public` (legacy `dataset` is also supported), and evaluation datasets, grader scripts, and test samples as `private`. Each download has an immutable `assetId`, a relative `path` beneath `/data/`, and an optional description. Use `extract_archive` to process ZIP/tar datasets, then poll `get_archive_job`; preserve the returned folders when attaching the classified assets. The server rejects unsafe archives and never recursively extracts nested archives. Private assets must never appear in project downloads or mounted datasets. New projects use `grader.adapter: "artifact-python"`. Set `graderAssetId` to private `grader.py`, `privateFiles` to `{assetId, path, description}` references beneath `/test_data/`, and `artifactPath` to the student output relative to `/output/` (default `submission.csv`). The grader defines `grade(submission_path: str, test_data_dir: str) -> dict[str, float]`. Set exactly one primary `metric` key and `direction` (`higher` maximizes; `lower` minimizes). Every returned metric must be finite numeric data, and the primary key must exist. Student code cannot see evaluation files or grader code.

Choose student `profile` and private `graderProfile` independently from `cpu-python`, `cuda-pytorch`, and `ros2`; both default to CPU. `runtimeSeconds` is a combined deadline, default 600 and maximum 3600. Do not upload requirements or select arbitrary images.

After a grading change, upload a private example artifact, call `test_grader` with `{projectId, expectedRevision, sampleAssetId, mode: "grader"}`, and poll `get_grader_test`. A passing **current example-artifact test** is required before publishing. Use `mode: "pipeline"` with a private `.py`/`.ipynb` sample for an optional full-pipeline test. Tests do not consume student quota or cooldown. Grading edits make old test results outdated; title, Markdown, and file-description edits retain validity. Keep incomplete projects unpublished so they do not block other updates. Grading changes create a new immutable grading version and leaderboard; description-only changes retain the current grading version. Archive projects/workshops to preserve submission history.

There are no role-promotion, shell, or database tools. Student approvals are managed by the instructor studio. Instructor promotion requires an SSH maintenance operator and an explicitly identified account. Do not attempt to bypass these limits.
