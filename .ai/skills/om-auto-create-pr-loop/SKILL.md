---
name: om-auto-create-pr-loop
description: Open Mercato repo-local extension of the shared `om-auto-create-pr-loop` skill (installed from open-mercato/skills into .agents/skills/). Pins the spec-completion gates (OM integration suites + om-ds-guardian) and the .ai/specs/enterprise spec scope.
---

# Auto Create PR Loop — Open Mercato extension

> **Base required (fork; zmiana 2026-10-31 — źródło: Koordynator (proces, Z7) 2026-10-31).** This file only extends the shared `om-auto-create-pr-loop` skill. Before acting, read the base at `.agents/skills/om-auto-create-pr-loop/SKILL.md`, or at `.claude/skills/om-auto-create-pr-loop/SKILL.md`, where `yarn install-skills` puts external skills by default (`--agent claude-code`). If neither exists, run `yarn install-skills`; if the base is still missing, STOP and report `missing base skill om-auto-create-pr-loop` — never apply this override on its own. Check: `node .ai/cezar/check-skill-bases.mjs`.

This file extends the shared `om-auto-create-pr-loop` skill from [open-mercato/skills](https://github.com/open-mercato/skills) (installed at `.agents/skills/om-auto-create-pr-loop/SKILL.md`). Follow the shared workflow with these repo specifics:

- **Spec sources**: work may be driven by a file under `.ai/specs/` or `.ai/specs/enterprise/` (enterprise scope). The run-folder contract is documented in `.ai/runs/README.md`.
- **Spec-completion gates**: "the repo's integration suite" means `yarn test:integration` (Playwright; see the `om-integration-tests` skill for ephemeral modes) plus `yarn test:create-app:integration` when the change touches template-synced surfaces. "Any style-compliance pass" means running the `om-ds-guardian` skill when UI was touched.
- **Checkpoint artifacts**: browser-automation transcripts are Playwright transcripts (`playwright.log`) per the OM QA setup.
- **Validation runner**: pick Docker vs local per root `AGENTS.md` § Validation Commands before running the gate.
