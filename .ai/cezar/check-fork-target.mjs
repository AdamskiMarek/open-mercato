#!/usr/bin/env node
// Preflight runu `om-story`: run musi celować w fork, nigdy w upstream.
// Cezar v0.15.1 (docs/reference.md, „Workflow graphs”): `git.push` nie ma pól, a
// `github.draft-pr` ma tylko `title?` — repo ani base nie da się ustawić w węźle.
// Push idzie na `origin` checkoutu, a PR celuje w `baseBranch` projektu
// (`.ai/cezar/config.json` w checkoucie projektu, „Configuration”). Ten skrypt (węzły
// `fork-target` i `push-guard`, typ `check`) zatrzymuje run, gdy:
//   1. `origin` (fetch i push) nie wskazuje AdamskiMarek/open-mercato,
//   2. `baseBranch` projektu nie jest `develop_OM_CRM` (brak pliku lub klucza = błąd),
//   3. punkt rozwidlenia runu (`CEZ_BASE`, gdy jest) nie leży na origin/develop_OM_CRM,
//   4. inny remote wskazuje open-mercato/open-mercato, a domyślne repo `gh` nie jest forkiem.
// zmiana 2026-10-31 — źródło: Koordynator 2026-10-31 (proces, Z7; review #40).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const FORK = 'AdamskiMarek/open-mercato'
const UPSTREAM = 'open-mercato/open-mercato'
const BASE = 'develop_OM_CRM'
const repoOf = (url) => url.trim().match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i)?.[1] ?? null
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const errors = []
const ok = []

// 1. origin
for (const flag of [[], ['--push']]) {
  const label = flag.length ? 'origin (push)' : 'origin (fetch)'
  let url = ''
  try { url = git('remote', 'get-url', ...flag, 'origin') } catch { errors.push(`${label}: brak remote origin`); continue }
  const repo = repoOf(url)
  if (repo?.toLowerCase() === FORK.toLowerCase()) ok.push(`${label} → ${FORK}`)
  else errors.push(`${label} = ${url} (oczekiwane github.com/${FORK})`)
}

// 2. baseBranch projektu (checkout projektu = katalog nad wspólnym .git worktree)
const commonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir')
const cfgPath = join(dirname(commonDir), '.ai/cezar/config.json')
if (!existsSync(cfgPath)) {
  errors.push(`brak ${cfgPath} — ustaw "baseBranch": "${BASE}" w projekcie Cezara`)
} else {
  let base
  try { base = JSON.parse(readFileSync(cfgPath, 'utf8')).baseBranch } catch (e) { errors.push(`${cfgPath}: niepoprawny JSON (${e.message})`) }
  if (base === BASE) ok.push(`baseBranch = ${BASE} (${cfgPath})`)
  else errors.push(`baseBranch = ${JSON.stringify(base)} w ${cfgPath} (oczekiwane "${BASE}")`)
}

// 3. punkt rozwidlenia runu na origin/develop_OM_CRM
if (process.env.CEZ_BASE) {
  try {
    git('fetch', '--quiet', 'origin', `+refs/heads/${BASE}:refs/remotes/origin/${BASE}`)
    execFileSync('git', ['merge-base', '--is-ancestor', process.env.CEZ_BASE, `refs/remotes/origin/${BASE}`], { stdio: 'ignore' })
    ok.push(`CEZ_BASE ${process.env.CEZ_BASE.slice(0, 9)} leży na origin/${BASE}`)
  } catch {
    errors.push(`CEZ_BASE ${process.env.CEZ_BASE} nie leży na origin/${BASE} (albo fetch się nie udał)`)
  }
}

// 4. remote upstream obok forka: `gh` mógłby wybrać upstream jako repo PR
const upstreamRemotes = git('remote').split('\n').filter(Boolean).filter((name) => {
  try { return repoOf(git('remote', 'get-url', name))?.toLowerCase() === UPSTREAM } catch { return false }
})
if (upstreamRemotes.length) {
  let def = ''
  try { def = execFileSync('gh', ['repo', 'set-default', '--view'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch {}
  if (def.toLowerCase() === FORK.toLowerCase()) ok.push(`gh repo set-default = ${FORK} (remote upstream: ${upstreamRemotes.join(', ')})`)
  else errors.push(`remote ${upstreamRemotes.join(', ')} wskazuje ${UPSTREAM}, a domyślne repo gh = ${JSON.stringify(def)} — uruchom \`gh repo set-default ${FORK}\` albo usuń ten remote`)
}

if (errors.length) {
  console.error('check-fork-target: FAIL — run nie celuje w fork:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('check-fork-target: OK')
for (const o of ok) console.log(`  - ${o}`)
