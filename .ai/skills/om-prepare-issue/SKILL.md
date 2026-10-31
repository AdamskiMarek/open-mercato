---
name: om-prepare-issue
description: Open Mercato repo-local extension of the shared `om-prepare-issue` skill (installed from open-mercato/skills into .agents/skills/). Adds the --enterprise spec scope, duplicate-spec checks across both spec trees, and the om-implement-spec/om-auto-fix-issue pickup path.
---

# Prepare Issue — Open Mercato extension

> **Base required (fork; zmiana 2026-10-31 — źródło: Koordynator (proces, Z7) 2026-10-31).** This file only extends the shared `om-prepare-issue` skill. Before acting, read the base at `.agents/skills/om-prepare-issue/SKILL.md`, or at `.claude/skills/om-prepare-issue/SKILL.md`, where `yarn install-skills` puts external skills by default (`--agent claude-code`). If neither exists, run `yarn install-skills`; if the base is still missing, STOP and report `missing base skill om-prepare-issue` — never apply this override on its own. Check: `node .ai/cezar/check-skill-bases.mjs`.

This file extends the shared `om-prepare-issue` skill from [open-mercato/skills](https://github.com/open-mercato/skills) (installed at `.agents/skills/om-prepare-issue/SKILL.md`). Follow the shared workflow with these repo specifics:

- **`--enterprise` (optional argument)**: write the spec under `.ai/specs/enterprise/` (commercial scope) instead of the default `.ai/specs/`; the spec PR then also carries the `enterprise` category label.
- **Duplicate check**: before writing, check both `.ai/specs/` and `.ai/specs/enterprise/` for an existing spec covering the same area — extend or supersede instead of duplicating, confirming direction with the user. Scan `.ai/lessons.md` by the task's module/area/topic tags and open only matching lesson records.
- **Spec methodology**: the repo-local `om-spec-writing` skill (`.ai/skills/om-spec-writing/SKILL.md`) applies in full, including the compliance-review gate and OM spec template.
- **Tracking issue**: state the pickup path — `/om-implement-spec` for the spec implementation (or `/om-auto-fix-issue` for a scoped bug), actionable only after the spec PR is merged into `develop`.
