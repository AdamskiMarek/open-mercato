#!/usr/bin/env node
// Preflight runu `om-story` (węzły `fork-target` i `push-guard`, typ `check`): run musi
// celować w fork AdamskiMarek/open-mercato i w gałąź develop_OM_CRM, nigdy w upstream.
// zmiana 2026-10-31 — źródło: Koordynator 2026-10-31 (proces, Z7; review #40, R2).
//
// Jak Cezar v0.15.1 kieruje push i PR (open-mercato/cezar@v0.15.1, packages/cezar/src):
// - remote push: `resolveTaskRemotes` (git-remotes.ts:97–124) — `remote.pushDefault`, gdy
//   wskazuje istniejący remote, inaczej `origin`. Tak pushują węzeł `git.push` (`pushBranch`,
//   git-worktree.ts:761) i `createDraftPr` (server/forge/github.ts:2620): `git push -u <remote>`.
// - repo PR: Cezar sam podaje `gh pr create --repo` (`prRepoArgs`) z remote'u base:
//   `remote.<r>.gh-resolved=base` (zapis `gh repo set-default`), inaczej remote będący
//   rodzicem forka `origin` według GitHuba (`forkParentRemote`, l.131–143), inaczej `origin`.
//   Ten drugi krok to ryzyko: przy remote upstream bez set-default PR trafiłby do upstream.
// - base PR: `--base` = `run.baseBranch` bez prefiksu `<remote>/` (`splitRemoteRef`); sha →
//   bez `--base`, czyli gałąź domyślna repo (`main`). `run.baseBranch` to `config.baseBranch`
//   tylko, gdy da się go rozwiązać — inaczej bieżąca gałąź checkoutu, z samą notą
//   (`chooseForkBase`, git-worktree.ts:197–218). Check dostaje go jako `CEZ_BASE`
//   (`checkContextEnv`, workflows/run.ts:7107; ustawiany tylko, gdy run ma baseBranch).
//
// FAIL (exit 1), gdy:
//   1. brak `CEZ_BASE` albo po zdjęciu prefiksu `<remote>/` (nazwa skonfigurowanego remote'u)
//      nie jest dokładnie `develop_OM_CRM` (sha, `main`, inna gałąź → FAIL);
//   2. któryś remote, na który może pójść push — `remote.pushDefault`,
//      `branch.<gałąź runu>.pushRemote`, `origin` — ma URL (fetch albo push, po insteadOf)
//      inny niż github.com/AdamskiMarek/open-mercato, albo wskazuje nieistniejący remote;
//   3. remote base PR (jak wyżej) nie jest forkiem: `gh-resolved=base` na innym remote'cie
//      niż fork albo — bez `gh-resolved` — istnieje remote spoza forka, który Cezar mógłby
//      wziąć jako rodzica forka;
//   4. remote z prefiksu `CEZ_BASE` nie jest forkiem;
//   5. `baseBranch` w `.ai/cezar/config.json` checkoutu projektu nie jest `develop_OM_CRM`.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const FORK = 'adamskimarek/open-mercato'
const BASE = 'develop_OM_CRM'

const run = (args) => {
  try {
    return { ok: true, out: execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  } catch {
    return { ok: false, out: '' }
  }
}
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)

// Jak `parseRemote` w git-remotes.ts, ale z dokładnym hostem i dokładnie owner/repo (N2-3).
function repoOf(url) {
  const r = url.trim().replace(/\/+$/, '')
  let m = /^(?:https?|ssh|git|git\+ssh):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(r)
  if (!m) m = /^(?:[^@/:]+@)?([^:/]+):(.+)$/.exec(r)
  if (!m) return null
  const [, host, path] = m
  if (host.toLowerCase() !== 'github.com') return null
  const parts = path.replace(/\.git$/i, '').split('/')
  if (parts.length !== 2 || parts.some((p) => !p)) return null
  return parts.join('/').toLowerCase()
}

const errors = []
const ok = []
const remotes = lines(run(['remote']).out)

// Wszystkie URL-e remote'u (fetch i push, po insteadOf/pushInsteadOf) muszą wskazywać fork.
function remoteIsFork(name, why) {
  if (!remotes.includes(name)) {
    errors.push(`${why}: remote "${name}" nie istnieje`)
    return false
  }
  const urls = [...lines(run(['remote', 'get-url', '--all', name]).out), ...lines(run(['remote', 'get-url', '--all', '--push', name]).out)]
  const bad = urls.filter((u) => repoOf(u) !== FORK)
  if (urls.length === 0 || bad.length) {
    errors.push(`${why}: remote "${name}" → ${bad.join(', ') || '(brak URL)'} (oczekiwane github.com/AdamskiMarek/open-mercato)`)
    return false
  }
  ok.push(`${why}: remote "${name}" → AdamskiMarek/open-mercato`)
  return true
}

// 1 + 4. CEZ_BASE
const cezBase = process.env.CEZ_BASE ?? ''
if (!cezBase) {
  errors.push('brak CEZ_BASE — Cezar nie podał bazy runu (run bez baseBranch), PR mógłby trafić do gałęzi domyślnej')
} else {
  // `splitRemoteRef`: najdłuższa nazwa skonfigurowanego remote'u jako prefiks.
  const prefix = remotes.filter((n) => cezBase.startsWith(`${n}/`) && cezBase.length > n.length + 1).sort((a, b) => b.length - a.length)[0]
  const branch = prefix ? cezBase.slice(prefix.length + 1) : cezBase
  if (branch !== BASE) errors.push(`CEZ_BASE = "${cezBase}" → base PR "${branch}" (oczekiwane dokładnie "${BASE}")`)
  else ok.push(`CEZ_BASE = "${cezBase}" → base PR "${BASE}"`)
  if (prefix) remoteIsFork(prefix, 'remote z CEZ_BASE')
}

// 2. remote push
const pushDefault = run(['config', '--get', 'remote.pushDefault']).out
if (pushDefault) remoteIsFork(pushDefault, 'remote.pushDefault')
const runBranch = process.env.CEZ_BRANCH || run(['symbolic-ref', '--quiet', '--short', 'HEAD']).out
if (runBranch) {
  const pushRemote = run(['config', '--get', `branch.${runBranch}.pushRemote`]).out
  if (pushRemote) remoteIsFork(pushRemote, `branch.${runBranch}.pushRemote`)
}
remoteIsFork('origin', 'origin')

// 3. remote base PR (`resolveTaskRemotes`)
const ghResolved = lines(run(['config', '--get-regexp', '^remote\\..*\\.gh-resolved$']).out)
  .map((l) => /^remote\.(.+)\.gh-resolved (.*)$/.exec(l))
  .filter((m) => m && m[2] === 'base')
  .map((m) => m[1])
  .filter((n) => remotes.includes(n))
if (ghResolved.length) {
  remoteIsFork(ghResolved[0], 'remote base PR (gh-resolved)')
} else {
  const others = remotes.filter((n) => n !== 'origin' && lines(run(['remote', 'get-url', '--all', n]).out).some((u) => repoOf(u) !== FORK))
  if (others.length) {
    errors.push(`remote ${others.join(', ')} spoza forka i brak gh-resolved — Cezar mógłby wziąć go jako rodzica forka (repo PR = upstream). Uruchom \`gh repo set-default AdamskiMarek/open-mercato\` albo usuń remote`)
  } else ok.push('remote base PR: origin (brak innych remote\'ów spoza forka)')
}

// 5. baseBranch projektu (checkout projektu = katalog nad wspólnym .git worktree)
const commonDir = run(['rev-parse', '--path-format=absolute', '--git-common-dir']).out
const cfgPath = commonDir ? join(dirname(commonDir), '.ai/cezar/config.json') : ''
if (!cfgPath || !existsSync(cfgPath)) {
  errors.push(`brak ${cfgPath || '.ai/cezar/config.json'} — ustaw "baseBranch": "${BASE}" w projekcie Cezara`)
} else {
  let base
  try {
    base = JSON.parse(readFileSync(cfgPath, 'utf8')).baseBranch
  } catch (e) {
    errors.push(`${cfgPath}: niepoprawny JSON (${e.message})`)
  }
  if (base === BASE) ok.push(`baseBranch = ${BASE} (${cfgPath})`)
  else errors.push(`baseBranch = ${JSON.stringify(base)} w ${cfgPath} (oczekiwane "${BASE}")`)
}

if (errors.length) {
  console.error('check-fork-target: FAIL — run nie celuje w fork / develop_OM_CRM:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('check-fork-target: OK')
for (const o of ok) console.log(`  - ${o}`)
