#!/usr/bin/env node
// Sprawdza, czy każdy override z .ai/skills/ (folder o nazwie skilla zewnętrznego z
// .ai/skills/tiers.json → external.skills) ma bazę (skill wspólny z open-mercato/skills).
// Bazę instaluje `yarn install-skills`. Domyślnie `npx skills add … --agent claude-code`
// kładzie ją w .claude/skills/<nazwa>/ (sprawdzone 2026-10-31 na develop_OM_CRM d2803f5c9:
// .agents/skills/ dostaje wtedy tylko linki do skilli lokalnych), a przy innym układzie
// w .agents/skills/<nazwa>/. Akceptujemy oba miejsca. Gdy instalacja zewnętrzna się nie
// uda, install-skills kończy się kodem 0 z samym ostrzeżeniem — ten skrypt zamienia to
// w twardy błąd, zanim agent dostanie sam override bez bazy.
// zmiana 2026-10-31 — źródło: Koordynator (proces, Z7) 2026-10-31.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

const root = process.cwd()
const tiers = JSON.parse(readFileSync(join(root, '.ai/skills/tiers.json'), 'utf8'))
const external = tiers?.external?.skills ?? []
const overrides = external.filter((name) => existsSync(join(root, '.ai/skills', name)))
const localDir = realpathSync(resolve(root, '.ai/skills'))

// Pusta lista override'ów = zły katalog roboczy albo zepsuty tiers.json, nie „wszystko OK”
// (zmiana 2026-10-31 — Koordynator 2026-10-31 (proces, Z7; review #40)).
if (overrides.length === 0) {
  console.error(`check-skill-bases: FAIL — brak override'ów z .ai/skills/tiers.json → external.skills w ${root}/.ai/skills (zły katalog roboczy albo tiers.json?)`)
  process.exit(1)
}

const BASE_DIRS = ['.agents/skills', '.claude/skills']
const found = []
const missing = []
for (const name of overrides) {
  // Baza to prawdziwy SKILL.md, nie link z powrotem do override'u w .ai/skills/.
  const base = BASE_DIRS.map((dir) => join(root, dir, name, 'SKILL.md')).find(
    (path) => existsSync(path) && !realpathSync(path).startsWith(localDir + sep),
  )
  if (base) found.push(`${name} → ${base.slice(root.length + 1)}`)
  else missing.push(name)
}

if (missing.length) {
  console.error(`check-skill-bases: FAIL — brak bazy dla ${missing.length}/${overrides.length} override'ów:`)
  for (const m of missing) console.error(`  - ${m} (brak w ${BASE_DIRS.join(' i ')})`)
  console.error('Uruchom `yarn install-skills` z dostępem do sieci (npx skills add open-mercato/skills).')
  process.exit(1)
}
console.log(`check-skill-bases: OK — ${overrides.length}/${overrides.length} override'ów ma bazę:`)
for (const f of found) console.log(`  - ${f}`)
