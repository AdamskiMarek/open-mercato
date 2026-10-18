import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GHCR_IMAGE, SOURCE, TARGET, transformCompose } from '../generate-ghcr-compose.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test(`${TARGET} stays generated from ${SOURCE}`, () => {
  const source = fs.readFileSync(path.join(ROOT, SOURCE), 'utf8')
  const current = fs.readFileSync(path.join(ROOT, TARGET), 'utf8')
  assert.strictEqual(current, transformCompose(source), `${TARGET} drifted — run: node scripts/generate-ghcr-compose.mjs`)
})

test(`${TARGET} pulls the GHCR image and never builds the app`, () => {
  const current = fs.readFileSync(path.join(ROOT, TARGET), 'utf8')
  assert.ok(!current.includes('open-mercato/app:'), 'local open-mercato/app image reference left')
  const appBlock = current.slice(current.indexOf('\n  app:\n'), current.indexOf('\n  documents-collab:\n'))
  assert.ok(!/^    build:/m.test(appBlock), 'app service still has a build section')
  assert.ok(appBlock.includes(`    image: ${GHCR_IMAGE}\n    pull_policy: always\n`))
})
