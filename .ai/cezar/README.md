# Cezar w forku — workflow `om-story`

**Status:** zmiana 2026-10-31 — źródło: Koordynator (proces, Z7) 2026-10-31. Wersja Cezara: v0.15.1 (format: `docs/reference.md` → „Workflow graphs (version: 2)”).

Ten katalog to konfiguracja Cezara dla repo (`.ai/cezar/workflows/` — workflow z plików). Przepływ zespołu: `../process/workflow.md` (P18, P22, P23). Etykiety QA w forku: `../process/workflow.md` → „Etykiety QA w forku”.

**Git:** `.gitignore` (upstream) ignoruje cały `.ai/cezar/` jako lokalny stan Cezara. Pliki tego katalogu (`README.md`, `check-skill-bases.mjs`, `check-fork-target.mjs`, `workflows/om-story.yaml`) są dodane `git add -f` — są śledzone mimo reguły, a `.gitignore` zostaje bez zmian (brak konfliktu przy synchronizacji z upstream). Dane runów Cezara (worktree, logi), `config.json` i klucz uruchomieniowy pozostają ignorowane (`.gitignore`:164–165 i `.ai/cezar/.gitignore`). Cezar czyta `.ai/cezar/workflows/` z checkoutu projektu, a `fork-target`, `skill-bases` i `push-guard` uruchamiają skrypty w worktree runu — dlatego te pliki muszą być w gałęzi.

**`git add -f` zawsze z pełną ścieżką pliku, nigdy z katalogiem** (zmiana 2026-10-31 — Koordynator 2026-10-31 (proces, Z7; review #40)): `git add -f .ai/cezar/` dodałby też ignorowany stan lokalny, w tym klucz uruchomieniowy. Nowy plik: `git add -f .ai/cezar/<ścieżka/do/pliku>`. Przed każdym commitem: `git status --ignored .ai/cezar` — w commicie mogą być tylko pliki wymienione wyżej.

## Od story do runu

1. Story w ClickUp (P22) ma kryteria akceptacji, numery D i TC oraz wersję (MVP / v1 / v2). Speka i plan testów są zmergowane, spec-check bez flag daje PASS, bramka gotowości daje PASS (P13).
2. Marek mówi „implementujemy” (P3). Dopiero wtedy Cezar tworzy run: projekt `open-mercato`, workflow `om-story`, treść zadania (`task`) z szablonu niżej. Base branch runu to `baseBranch` projektu w Cezarze — musi być `develop_OM_CRM`, a remote push i remote base PR checkoutu projektu muszą wskazywać `AdamskiMarek/open-mercato`. Tego nie ustawia graf (patrz „Cel: fork, nie upstream”); sprawdza to węzeł `fork-target` przed `setup` i `push-guard` przed `push` — inaczej run kończy się `stopped`.
3. Run kończy się draft PR do `develop_OM_CRM` albo stanem `Stopped` (failed) z powodem w logu runu.
4. Dalej bez Cezara: review w sesji uruchomionej przez Kod (P15) → „merguj” od Marka (P5) → merge → Weryfikator na TC (P18) → zamknięcie (P22). W grafie nie ma `gate.human` ani merge.

## Graf `om-story`

| Węzeł | Typ | Co robi | Wyjścia |
|---|---|---|---|
| `fork-target` | check | `node .ai/cezar/check-fork-target.mjs` — `CEZ_BASE` = `develop_OM_CRM`, remote push i remote base PR = fork (patrz „Cel: fork, nie upstream”) | pass → `setup`; fail → `stopped` |
| `setup` | check | `yarn install --immutable && yarn install-skills && yarn build:packages && yarn generate && yarn build:packages` | pass → `skill-bases`; fail → `stopped` |
| `skill-bases` | check | `node .ai/cezar/check-skill-bases.mjs` — każdy override z `.ai/skills/` ma bazę (patrz niżej) | pass → `implement`; fail → `stopped` |
| `implement` | agent | skill `om-implement-spec`, runner `copilot`, model `claude-sonnet-4.6`, prompt `{{task}}` | done → `verify`; failed → `stopped` |
| `verify` | check | `yarn i18n:check-sync && yarn i18n:check-usage && yarn typecheck && yarn lint && yarn test` | pass → `review`; fail → `fix-loop` |
| `fix-loop` | loop | max 2 | repeat → `fix`; exhausted → `stopped` |
| `fix` | agent | `session.continue: implement`; dostaje wyjście `verify` i treść zadania | done → `verify` |
| `review` | agent | skill `om-code-review`, werdykty `approve` / `changes` | approve → `commit`; changes → `review-loop`; failed → `stopped` |
| `review-loop` | loop | max 2 | repeat → `address`; exhausted → `stopped` |
| `address` | agent | `session.continue: implement`; dostaje podsumowanie review | done → `verify` |
| `commit` | git.commit | `feat(crm): implementacja story (workflow om-story)` | done / nothing → `push-guard`; failed → `stopped` |
| `push-guard` | check | ten sam skrypt co `fork-target`, tuż przed push (agent mógł zmienić remote) | pass → `push`; fail → `stopped` |
| `push` | git.push | `git push -u` gałęzi runu na remote push Cezara (`remote.pushDefault`, inaczej `origin`) | done → `pr`; failed → `stopped` |
| `pr` | github.draft-pr | ponowny push, potem `gh pr create --draft --repo <remote base> --base <CEZ_BASE bez prefiksu>` | created → `done` (success); failed → `stopped` |

Każdy cykl przechodzi przez węzeł `loop`; port bez krawędzi nie występuje (wszystkie porty błędu prowadzą do `stopped`).

## Cel: fork, nie upstream

Zmiana 2026-10-31 — źródło: Koordynator 2026-10-31 (proces, Z7; review #40).

Według `docs/reference.md` Cezara v0.15.1 („Workflow graphs (`version: 2`)”, tabela węzłów) `git.push` nie ma żadnych pól, a `github.draft-pr` ma tylko `title?` — repo, remote ani base PR nie ustawia się w grafie. Wybiera je kod Cezara (open-mercato/cezar@v0.15.1, `packages/cezar/src`; zmiana 2026-10-31 — Koordynator 2026-10-31 (proces, Z7; review #40 R2-4)):

- **Remote push** — `resolveTaskRemotes` (`git-remotes.ts`:97–124): `remote.pushDefault`, gdy wskazuje istniejący remote, inaczej `origin`. Na ten remote pushują węzeł `push` (`pushBranch`, `git-worktree.ts`:761, `git push -u <remote> <gałąź>`) i ponownie węzeł `pr` (`createDraftPr`, `server/forge/github.ts`:2620). Cezar podaje remote jawnie, więc `branch.<gałąź>.pushRemote` go nie zmienia — skrypt i tak go sprawdza, bo zwykły `git push` agenta w worktree by go użył.
- **Repo PR** — Cezar sam podaje `gh pr create --draft --repo <host/owner/repo>` (`createDraftPr`) z URL remote'u base. Remote base według `resolveTaskRemotes`: remote z `gh-resolved=base` (zapis `gh repo set-default`), inaczej remote będący rodzicem forka `origin` według GitHuba (`forkParentRemote`, `git-remotes.ts`:131–143), inaczej `origin`. **Ryzyko:** przy dodanym remote upstream (`open-mercato/open-mercato`) bez `gh repo set-default` Cezar uzna upstream za repo PR. Pokrywają to `fork-target` i `push-guard` (warunek 3 niżej).
- **Base PR** — `--base` to `run.baseBranch` bez prefiksu `<remote>/`. `run.baseBranch` = `baseBranch` projektu, ale tylko gdy da się go rozwiązać w checkoucie; inaczej Cezar bierze bieżącą gałąź checkoutu i zostawia jedynie notę (`chooseForkBase`, `git-worktree.ts`:197–218). Przy odłączonym HEAD albo `forkRef` jest to sha — wtedy `--base` nie pada i PR idzie do gałęzi domyślnej repo (`main`). Węzeł `check` dostaje tę wartość jako `CEZ_BASE` (`checkContextEnv`, `workflows/run.ts`:7107; tylko gdy run ma baseBranch).

Dlatego graf ma dwa węzły `check` z tym samym skryptem `check-fork-target.mjs` — `fork-target` przed `setup` i `push-guard` przed `push` (agent mógł zmienić remote albo konfigurację git). Skrypt kończy run błędem (exit 1), gdy:

1. brak `CEZ_BASE` albo po zdjęciu prefiksu `<remote>/` (nazwa skonfigurowanego remote'u) nie jest on dokładnie `develop_OM_CRM` — sha, `main` czy inna gałąź to FAIL (równość, nie „leży na”);
2. remote, na który może pójść push — `remote.pushDefault`, `branch.<gałąź runu>.pushRemote` (gałąź z `CEZ_BRANCH` albo HEAD), `origin` — nie istnieje albo któryś jego URL (fetch lub push, po `insteadOf`/`pushInsteadOf`) nie jest dokładnie `github.com/AdamskiMarek/open-mercato` (host porównywany w całości: `evilgithub.com/...` to FAIL);
3. remote base PR nie jest forkiem: `gh-resolved=base` stoi na remote'cie spoza forka albo — bez `gh-resolved` — istnieje remote spoza forka, który Cezar mógłby wziąć za rodzica forka;
4. remote z prefiksu `CEZ_BASE` nie jest forkiem;
5. w `.ai/cezar/config.json` checkoutu projektu (katalog nad wspólnym `.git` worktree) nie ma `"baseBranch": "develop_OM_CRM"` — brak pliku, klucza albo niepoprawny JSON też jest błędem.

Przed pierwszym runem w projekcie Cezara: `origin` = fork, `baseBranch` = `develop_OM_CRM` (zakładka Git albo `config.json`), bez `remote.pushDefault`/`pushRemote` na inny remote, bez remote upstream albo z `gh repo set-default AdamskiMarek/open-mercato`. Skrypt sprawdzono lokalnie (2026-10-31, repo tymczasowe): fork + `CEZ_BASE` = `develop_OM_CRM` lub `origin/develop_OM_CRM` → exit 0; brak `CEZ_BASE`, `CEZ_BASE` = `main` / `origin/main` / `e85aec2`, `pushDefault` = upstream, `branch.<b>.pushRemote` = upstream, remote upstream bez `gh-resolved`, `evilgithub.com`, `pushurl`/`pushInsteadOf` na upstream, `baseBranch: develop`, brak `config.json` → exit 1. W Cezarze nie był uruchomiony.

## Szablon zadania (`task`)

```text
Story: <ID ClickUp> — <tytuł story> (wersja: MVP | v1 | v2)
Speka: .ai/specs/<plik speki>.md — sekcje: <§…>
Plan testów: .ai/specs/<plik planu>.md — TC do pokrycia: <TC-…, TC-…>
Decyzje: <D…, D…>
Kryteria akceptacji:
- <kryterium 1>
- <kryterium 2>
Zakres: tylko to story. Poza zakresem: <…>

Stałe odpowiedzi (tryb autonomiczny — nie zadawaj tych pytań):
- om-implement-spec „Extension Mode Decision”: wybór 1 — External extension. Kod jako moduł
  aplikacji w apps/mercato/src/modules/<moduł>, rejestracja w apps/mercato/src/modules.ts.
  Zero zmian w packages/core (D45). Bez pytania „Are you sure?” — opcja 2 (Core modification)
  jest w tym repo wykluczona.
- Brakuje punktu rozszerzeń w core: nie zmieniaj packages/core. Zatrzymaj pracę i opisz brakujący
  punkt w podsumowaniu (pytanie do Koordynatora); nie obchodź go kopią kodu core.
- Testy: każdy TC ze story ma test w tym samym PR.
- Nie merguj i nie ustawiaj etykiet QA (.ai/process/workflow.md → „Etykiety QA w forku”).
```

Stała odpowiedź na pytanie om-implement-spec (extension vs core) wynika z D45 („Własne moduły jako moduły aplikacji w forku (`apps/mercato/src/modules`), bez zmian w `packages/core`”). Zmienia ją tylko nowa decyzja w `.ai/decisions.md`.

## Override'y skilli i ich bazy

Override w `.ai/skills/<nazwa>/` (nazwa z `.ai/skills/tiers.json` → `external.skills`) tylko rozszerza skill wspólny z open-mercato/skills. W świeżym worktree bazy nie ma (`.agents/` jest w `.gitignore`), a Cezar wybiera override przed bazą (kolejność: `.ai/cezar/skills` → `.ai/skills` → `.agents/skills` → `.claude/skills` → …). Bez bazy agent dostałby sam dodatek bez właściwego workflow.

Rozwiązanie (zmiana 2026-10-31):

1. `setup` uruchamia `yarn install-skills`, które instaluje bazy.
2. `skill-bases` sprawdza każdą bazę i zatrzymuje run, gdy którejś brakuje. Jest potrzebny, bo `install-skills` przy błędzie instalacji zewnętrznej kończy się kodem 0 z samym ostrzeżeniem (`scripts/install-skills.mjs`, `installExternal`).
3. Każdy override, który jest rozszerzeniem (9 plików), oraz `om-integration-tests` i `om-spec-writing` mają na początku blok „Base required”: najpierw przeczytaj bazę, przy braku uruchom `yarn install-skills`, a gdy nadal jej nie ma — STOP z komunikatem `missing base skill <nazwa>`. W `om-integration-tests` blok obejmuje cały skill i obie bazy (`om-integration-tests`, `om-prepare-test-env`) — zmiana 2026-10-31, Koordynator 2026-10-31 (proces, Z7; review #40).
4. `skill-bases` kończy się błędem także wtedy, gdy lista override'ów jest pusta (zły katalog roboczy albo `tiers.json`), a link z powrotem do `.ai/skills/` rozpoznaje po pełnym prefiksie katalogu (zmiana 2026-10-31, Koordynator 2026-10-31 (proces, Z7; review #40)).
5. Strażnik merge (zmiana 2026-10-31 — reguła merge: Marek, stała zasada; strażnik: Koordynator 2026-10-31 (proces, Z7; review #40)): `om-approve-merge-pr` i `om-merge-buddy` mają override'y — kopie `SKILL.md` z open-mercato/skills@c116279 bez zmian, ze strażnikiem na początku; `om-pr-autopilot` ma strażnik przy kroku merge. Bez „merguj” Marka dla danego PR żaden z nich nie merguje (`../process/workflow.md` → „Etykiety QA w forku”). Override'ów jest 13.

Miejsce bazy: domyślnie `yarn install-skills` instaluje skille zewnętrzne z `--agent claude-code` do `.claude/skills/<nazwa>/`, a `.agents/skills/` dostaje wtedy tylko linki do skilli lokalnych (sprawdzone 2026-10-31 na `develop_OM_CRM` d2803f5c9). Tekst override'ów podaje `.agents/skills/<nazwa>/SKILL.md`, więc blok „Base required” i skrypt akceptują oba miejsca.

Bez bloku „Base required”: `om-mockup-prototype` — pełny skill spoza listy `external.skills`. `om-spec-writing` to też pełny skill, ale jest na liście `external.skills`, więc `skill-bases` wymaga jego bazy — stąd blok (zmiana 2026-10-31).

## Ograniczenia (stan v0.15.1)

- **Sesja przy `copilot`:** `session.continue` działa tylko dla runnerów `claude`, `codex`, `pi` (`packages/cezar/src/workflows/run.ts`, `RESUMABLE_BACKENDS`). Dla `copilot` węzły `fix` i `address` startują w świeżej sesji (Cezar zapisuje notę „session.continue: starting fresh”). Dlatego ich prompty zawierają pełną treść zadania i wyjście `verify` albo review. Zmiany z `implement` są w tym samym worktree.
- **Werdykt przy `copilot`:** ponowne pytanie o brakujący `CEZ:VERDICT` działa tylko dla runnerów z wznawianiem sesji. Przy `copilot` brak werdyktu oznacza `review.failed` → `stopped`.
- **Base branch w skillach:** skille czytają `BASE_BRANCH` z `.ai/agentic.config.json` (`"develop"`) — osobny PR konfiguracyjny zmienia to na `develop_OM_CRM`.
- **Zasoby:** kontener Cezara ma limit 2,5 GB RAM i 1 rdzeń CPU (`GET /api/v1/workspace/host-usage`, 2026-10-31). Pełnego buildu monorepo (`setup` + `verify`) w Cezarze nigdy nie zmierzono.

## Walidacja pliku

- Typy węzłów i porty zgodne z `GET /api/v1/workflows/nodes` (Cezar na VPS, 2026-10-31).
- Plik przechodzi offline schemat `workflowGraphFileSchema` i `graphIssues()` z kodu Cezara v0.15.1 (`packages/cezar/src/workflows/graph.ts`) — wynik `[]`, tak jak loader `.ai/cezar/workflows/` (`workflows/load.ts`).
- `POST /api/v1/workflows/validate` nie był użyty (tylko GET wobec API Cezara). Graf nie był uruchomiony.
- Węzły `fork-target` i `push-guard` (zmiana 2026-10-31) używają tylko pól `check` z `docs/reference.md` (`id`, `type`, `name`, `command`) i portów `pass` / `fail`. Po tej zmianie plik ponownie przechodzi offline `workflowGraphFileSchema` i `graphIssues()` z v0.15.1 — wynik `[]` (2026-10-31).
