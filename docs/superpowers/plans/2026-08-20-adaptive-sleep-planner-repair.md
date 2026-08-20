# Adaptive Sleep Planner Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the current Adaptive Sleep Planner implementation to the approved product contracts, make every local deterministic gate pass, and leave credential-gated deployment checks explicitly runnable rather than silently skipped.

**Architecture:** Preserve the existing Next.js modular monolith and the dependency direction UI → application → domain → repository → Prisma. Repair contracts from the lowest shared boundary upward: toolchain and adapters, ownership and onboarding, records and time, analysis, planner/narration/Care, UI/accessibility, then database/browser/release gates.

**Tech Stack:** Node.js 22/24, npm, Next.js 16.3.1 App Router, React 19.2.8, TypeScript strict, Prisma 7.9.1, Better Auth 1.7.1, PostgreSQL, SQLite, Temporal, Zod, Vitest 4, Testing Library, Playwright 1.62.1, CSS Modules

**Spec:** `docs/superpowers/specs/2026-08-20-adaptive-sleep-planner-repair-design.md`

## Global Constraints

- Keep npm as the only package manager and `package-lock.json` as the only lockfile.
- Keep Next.js, React, Prisma, Better Auth, ESLint, TypeScript, Vitest, and Playwright on mutually compatible stable releases; exact repair pins are Node `>=22.13 <25`, `jsdom@29.1.1`, `@prisma/adapter-better-sqlite3@7.9.1`, `auth@1.7.1`, and `vercel@59.1.4` unless upstream metadata changes before implementation.
- Preserve the existing UI → application → domain → repository → Prisma boundaries; do not rewrite the modular monolith.
- Instantiate Prisma 7 with an explicit driver adapter for both `postgresql:`/`postgres:` and `file:` database URLs.
- Treat Next.js 16 `params`, `searchParams`, `cookies()`, and `headers()` as asynchronous APIs.
- Never hide Better Auth initialization errors behind a handler that looks successfully configured; browser authentication must use the current origin.
- Every user-owned row must carry `userId`; parent/child lookups must validate both the parent identity and the same user where the schema permits it.
- Interpret `datetime-local` values with the stored IANA timezone through Temporal; reject DST gaps and require explicit disambiguation for repeated wall times.
- Keep health values and record identifiers out of query strings and browser history; draft state is pathname-scoped `sessionStorage` only.
- Validate versioned Baseline and Analysis JSON on both read and write and reject payloads above 64 KiB.
- Readiness is `null` only when sleep duration is absent; other missing observations re-normalize the observed weights.
- Rule-engine facts remain authoritative for numbers and schedules; LLM text may explain but never substitute or reassign facts.
- `PlanDay.localDate` is its wake date. All displayed times use the user's stored timezone.
- All production changes follow RED → verify expected failure → minimal GREEN → adjacent regression suite → task review.
- Do not describe PostgreSQL, visual, preview, or production smoke as passing when credentials or runtime services prevent execution; run the deterministic local equivalent and report the external gap.

---

### Task 1: Restore the executable toolchain and deterministic test harness

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Modify: `vitest.setup.ts`
- Modify: `src/modules/analysis/domain/calculate-readiness.ts`
- Modify: `tests/unit/ready-route.test.ts`
- Modify: component tests that require a `next/navigation` router fixture
- Test: `tests/unit/ready-route.test.ts`
- Test: `tests/component/care-tool-lifecycle.test.tsx`
- Test: `tests/component/today.test.tsx`
- Test: `tests/component/onboarding-ui.test.tsx`
- Test: `tests/component/plan-screen.test.tsx`

**Interfaces:**
- Consumes: the current npm scripts `lint`, `typecheck`, and `test:run`.
- Produces: a clean executable lint/typecheck/test harness for every later task.

- [ ] **Step 1: Capture the existing RED gates**

Run:

```powershell
npm ci
npm run lint
npm run typecheck
npm run test:run
```

Expected RED evidence:

```text
ESLint couldn't find an eslint.config.(js|mjs|cjs) file
src/modules/analysis/domain/calculate-readiness.ts(29,108): error TS1005: ')' expected
Test Files 27 failed | 42 passed
Tests 20 failed | 128 passed
```

- [ ] **Step 2: Add the supported Next.js flat ESLint configuration**

Create `eslint.config.mjs` with the Next 16 flat configs and generated-output ignores:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "out/**",
    "playwright-report/**",
    "test-results/**",
    "src/generated/prisma/**",
    "prisma/schema.active.prisma",
    "prisma/schema.auth-check.prisma",
  ]),
]);
```

- [ ] **Step 3: Make the package/runtime matrix compatible and quiet**

Update `package.json` and regenerate `package-lock.json` so the effective values are:

```json
{
  "engines": { "node": ">=22.13 <25" },
  "devDependencies": {
    "jsdom": "29.1.1"
  }
}
```

Remove `vite-tsconfig-paths` and use Vite's native path resolution:

```ts
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: { provider: "v8", reporter: ["text"] },
  },
});
```

- [ ] **Step 4: Repair only the parser blocker and prove the semantic work remains isolated**

Change the broken line to:

```ts
const observed = items.filter(
  (entry): entry is [keyof ReadinessWeights, number] => isAvailable(entry[1]),
);
```

Do not change readiness nullability in this task; Task 5 owns that contract.

- [ ] **Step 5: Make the test harness clean up real rendered components**

Use global Testing Library cleanup:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

Use `vi.hoisted` for the ready-route mock and a real minimal `next/navigation` router fixture for component tests:

```ts
const mocks = vi.hoisted(() => ({
  probeDatabaseReadiness: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
```

- [ ] **Step 6: Verify the harness unlocks the real failures**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run -- tests/unit/ready-route.test.ts tests/component/care-tool-lifecycle.test.tsx tests/component/today.test.tsx tests/component/onboarding-ui.test.tsx tests/component/plan-screen.test.tsx
```

Expected: lint and typecheck proceed past their startup blockers; duplicate-DOM and mock-TDZ failures disappear. Any remaining assertion failures must correspond to later tasks rather than harness contamination.

- [ ] **Step 7: Review and commit**

```powershell
git add eslint.config.mjs package.json package-lock.json vitest.config.ts vitest.setup.ts src/modules/analysis/domain/calculate-readiness.ts tests/unit/ready-route.test.ts tests/component
git commit -m "chore: restore executable quality gates"
```

---

### Task 2: Repair Prisma adapters, Better Auth, and Next 16 request contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/shared/db/prisma.ts`
- Create: `tests/support/prisma-client.ts`
- Modify: `src/shared/auth/auth.ts`
- Modify: `src/shared/auth/auth-client.ts`
- Modify: `src/shared/auth/require-session-user.ts`
- Modify: `src/app/api/auth/[...all]/route.ts`
- Modify: `src/app/(app)/record/caffeine/page.tsx`
- Modify: `src/app/(app)/record/alcohol/page.tsx`
- Modify: `src/app/(app)/record/sleep-phone/page.tsx`
- Modify: `src/app/(app)/record/meal-health/page.tsx`
- Modify: Prisma integration tests that instantiate `PrismaClient` without an adapter
- Test: `tests/integration/auth-handler.test.ts`
- Test: `tests/unit/auth-origin.test.ts`
- Test: `tests/unit/database-provider.test.ts`
- Test: `tests/integration/database-contract.test.ts`

**Interfaces:**
- Consumes: `providerForUrl(url): "sqlite" | "postgresql"` and the generated `PrismaClient`.
- Produces: `createPrismaClient(databaseUrl: string): PrismaClient`, `getPrismaClient(): PrismaClient`, and a lazy Better Auth accessor that either returns a configured instance or throws the real initialization error.

- [ ] **Step 1: Write failing adapter and auth behavior tests**

Add a SQLite test that performs a real query through the application factory and an auth test that exercises a request instead of checking function types:

```ts
it("connects to SQLite through an explicit Prisma 7 adapter", async () => {
  const prisma = createPrismaClient(`file:${databasePath}`);
  await expect(prisma.$queryRaw`SELECT 1 AS value`).resolves.toBeDefined();
  await prisma.$disconnect();
});

it("does not replace an initialization error with a configured-looking handler", () => {
  expect(() => createAuth({ DATABASE_URL: "", BETTER_AUTH_SECRET: "" }))
    .toThrow("DATABASE_URL is required");
});
```

Add a same-origin client assertion by observing the URL used for a client request; it must begin with `/api/auth`, not `http://127.0.0.1:3000`.

- [ ] **Step 2: Run the targeted tests and verify RED**

```powershell
npm run test:run -- tests/integration/auth-handler.test.ts tests/unit/auth-origin.test.ts tests/unit/database-provider.test.ts tests/integration/database-contract.test.ts
```

Expected RED: SQLite reports that a driver adapter is required; configured auth returns `500 Authentication is not configured`; browser auth targets the hard-coded loopback origin.

- [ ] **Step 3: Install and pin the required runtime tools**

Add exact versions and regenerate the lockfile:

```json
{
  "dependencies": {
    "@prisma/adapter-better-sqlite3": "7.9.1"
  },
  "devDependencies": {
    "auth": "1.7.1",
    "vercel": "59.1.4"
  }
}
```

- [ ] **Step 4: Centralize explicit Prisma adapter creation**

Implement both URL branches and never construct a bare Prisma client:

```ts
export const createPrismaClient = (databaseUrl: string): PrismaClient => {
  const provider = providerForUrl(databaseUrl);
  const adapter = provider === "postgresql"
    ? new PrismaPg({ connectionString: databaseUrl })
    : new PrismaBetterSQLite3({ url: databaseUrl });

  return new PrismaClient({ ...logConfig, adapter });
};
```

`tests/support/prisma-client.ts` must call this production factory so tests validate the same adapter path.

- [ ] **Step 5: Configure Better Auth with the explicit database provider and fail honestly**

Use the supported adapter signature:

```ts
database: prismaAdapter(prisma, {
  provider: providerForUrl(databaseUrl),
}),
```

Replace the broad catch/fallback singleton with a lazy accessor. Route handlers call the accessor at request time, so build-time imports remain deterministic while missing or invalid runtime configuration produces the real error response. Update session lookup call sites to use the same accessor.

- [ ] **Step 6: Use same-origin browser authentication**

Create the browser client without a loopback or deployment-specific absolute origin:

```ts
export const authClient = createAuthClient({
  basePath: "/api/auth",
});
```

If the installed client type uses a different same-origin option, follow its exported type definition and preserve the observable `/api/auth` behavior.

- [ ] **Step 7: Make every record page await `searchParams`**

Use one contract on all four pages:

```ts
type RecordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecordPage({ searchParams }: RecordPageProps) {
  const params = (await searchParams) ?? {};
  return <RecordFlow initialDraft={toInitialDraft(params)} />;
}
```

Task 4 removes health query payloads entirely; this step only restores the Next 16 API contract.

- [ ] **Step 8: Verify and commit**

```powershell
npm run test:run -- tests/integration/auth-handler.test.ts tests/unit/auth-origin.test.ts tests/unit/database-provider.test.ts tests/integration/database-contract.test.ts
npm run typecheck
npm run build
git add package.json package-lock.json src/shared/db src/shared/auth src/app/api/auth 'src/app/(app)/record' tests/support tests/integration tests/unit
git commit -m "fix: configure database and authentication adapters"
```

---

### Task 3: Enforce user ownership, migrations, and working onboarding

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/20260819000000_initial_postgresql/migration.sql`
- Create: `prisma/migrations-sqlite/20260819000000_initial_sqlite/migration.sql`
- Modify: `scripts/prepare-prisma-schema.mjs`
- Modify: `scripts/verify-migrations.ts`
- Modify: `scripts/verify-auth-schema.ts`
- Modify: `src/modules/onboarding/infrastructure/prisma-onboarding-repository.ts`
- Modify: all four `src/app/(onboarding)/onboarding/*/actions.ts`
- Modify: all four onboarding page components as required by the selected action contract
- Test: `tests/integration/database-contract.test.ts`
- Test: `tests/integration/onboarding-persistence.test.ts`
- Test: `tests/integration/auth-handler.test.ts`
- Test: `tests/component/onboarding-ui.test.tsx`

**Interfaces:**
- Consumes: the adapter-aware Prisma factory from Task 2.
- Produces: database-enforced cascade ownership, parent/user composite ownership where applicable, atomic onboarding upserts, and form actions whose runtime signature matches their JSX usage.

- [ ] **Step 1: Add failing ownership, concurrency, and form-action tests**

```ts
it("cascades onboarding settings when User is deleted directly", async () => {
  await seedCompleteOnboarding(prisma, userId);
  await prisma.user.delete({ where: { id: userId } });
  await expect(readOnboardingCounts(prisma, userId)).resolves.toEqual({
    profiles: 0,
    goals: 0,
    habits: 0,
    connections: 0,
  });
});

it("leaves one complete onboarding state after concurrent writes", async () => {
  await Promise.all([
    repository.saveProfile(scope, firstProfile),
    repository.saveProfile(scope, secondProfile),
  ]);
  await expect(prisma.userProfile.count({ where: { userId } })).resolves.toBe(1);
});
```

Add a component/integration test that submits a real `FormData` through the exact action signature used by `<form action={...}>`; it must not throw because a second argument is absent.

- [ ] **Step 2: Run and verify RED**

```powershell
npm run test:run -- tests/integration/database-contract.test.ts tests/integration/onboarding-persistence.test.ts tests/component/onboarding-ui.test.tsx
```

Expected RED: direct User deletion leaves settings, and direct form action invocation observes `formData === undefined`.

- [ ] **Step 3: Add direct User relations and composite ownership constraints**

Add reverse relations on `User`, add `user @relation(..., onDelete: Cascade)` to `UserProfile`, `SleepGoal`, `UserHabit`, and `Connection`, and add compound uniqueness/relations for children that must match both parent id and `userId`. The resulting shape must enforce patterns such as:

```prisma
model PlanDay {
  id     String
  userId String

  @@unique([id, userId])
}

model RoutineCompletion {
  planDayId String
  userId    String
  planDay   PlanDay @relation(fields: [planDayId, userId], references: [id, userId], onDelete: Cascade)
}
```

Apply the same ownership principle to optional Narration targets without allowing both targets or neither target.

- [ ] **Step 4: Make both migration histories executable from an empty database**

Update PostgreSQL foreign keys and CHECK constraints to match the canonical model. Add a complete SQLite initial migration rather than an alter-only fragment. Extend `verify-migrations.ts` to create fresh temporary databases/schemas, apply the history, and verify the required constraints through observable inserts/deletes.

- [ ] **Step 5: Use one correct onboarding action contract**

Choose one of these complete patterns and apply it consistently:

```ts
export async function submitProfileAction(formData: FormData): Promise<void> {
  const values = Object.fromEntries(formData.entries());
  await saveProfile(values);
}
```

or:

```tsx
const [state, action, pending] = useActionState(submitProfileAction, initialState);
return <form action={action} aria-busy={pending}>...</form>;
```

Do not retain a `(previousState, formData)` handler behind a direct server `<form action={handler}>`.

- [ ] **Step 6: Exercise real Better Auth flows against the dedicated test database**

Extend the auth integration suite to send actual signup, session, signout, signin, and protected-route requests. Assert cookies/session ownership and do not replace the database/auth boundary with handler-type mocks.

- [ ] **Step 7: Verify and commit**

```powershell
npm run verify:migrations
npm run verify:auth-schema
npm run test:run -- tests/integration/database-contract.test.ts tests/integration/onboarding-persistence.test.ts tests/integration/auth-handler.test.ts tests/component/onboarding-ui.test.tsx
git add prisma scripts src/modules/onboarding 'src/app/(onboarding)' tests
git commit -m "fix: enforce ownership and onboarding persistence"
```

---

### Task 4: Repair direct-entry time, privacy, CRUD, recalculation, and idempotency

**Files:**
- Modify: `src/shared/time/zoned-date-time.ts`
- Modify: `src/modules/records/domain/schemas.ts`
- Modify: `src/modules/records/application/record-service.ts`
- Modify: `src/modules/records/application/ports.ts`
- Modify: `src/modules/records/infrastructure/prisma-mutation-receipt-repository.ts`
- Modify: `src/modules/records/infrastructure/prisma-record-repository.ts`
- Modify: record server actions and all record page/flow components
- Modify: `src/app/(app)/analyze/actions.ts`
- Modify: Record Hub components and view model
- Test: `tests/unit/zoned-date-time.test.ts`
- Test: `tests/integration/record-service.test.ts`
- Test: `tests/integration/mutation-receipt.test.ts`
- Test: `tests/component/intake-flows.test.tsx`
- Test: `tests/component/record-hub.test.tsx`
- Test: `tests/e2e/record-crud.spec.ts`
- Test: `tests/unit/analyze-what-if-action.test.ts`

**Interfaces:**
- Consumes: `UserScope.timezone`, Temporal wall-time parsing, the adapter-aware transaction boundary, and pathname-scoped `sessionStorage`.
- Produces: normalized UTC commands, complete category CRUD, old/new affected-date recalculation, and receipt identity over operation + key + normalized command body.

Introduce `parseRecordWallTime` as the record-facing wrapper around the existing `parseZonedDateTime` helper so record actions share the Temporal/DST contract without duplicating timezone logic.

- [ ] **Step 1: Add the missing RED cases**

```ts
it("rejects a DST gap in the user's stored timezone", () => {
  expect(() => parseRecordWallTime("2026-03-08T02:30", "America/New_York"))
    .toThrow("NONEXISTENT_LOCAL_TIME");
});

it("requires an explicit offset for a repeated wall time", () => {
  expect(() => parseRecordWallTime("2026-11-01T01:30", "America/New_York"))
    .toThrow("AMBIGUOUS_LOCAL_TIME");
});

it("recalculates rolling windows for both dates after a moved record", async () => {
  await service.update(scope, { ...existing, consumedAt: movedInstant }, key);
  expect(recalculate).toHaveBeenCalledWith(expect.arrayContaining([
    "2026-08-10",
    "2026-08-11",
    "2026-08-23",
    "2026-08-24",
  ]));
});

it("conflicts when one idempotency key is reused with a different body", async () => {
  await service.create(scope, firstCommand, key);
  await expect(service.create(scope, secondCommand, key)).rejects.toMatchObject({
    code: "IDEMPOTENCY_CONFLICT",
  });
});
```

Add a rendered intake test that advances each multi-step flow and asserts `window.location.search === ""`, the draft exists under the pathname key, and back/refresh restores it from `sessionStorage`.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -- tests/unit/zoned-date-time.test.ts tests/integration/record-service.test.ts tests/integration/mutation-receipt.test.ts tests/component/intake-flows.test.tsx tests/component/record-hub.test.tsx tests/unit/analyze-what-if-action.test.ts
```

Expected RED: local wall times are parsed with `new Date`, old dates are omitted, hash input omits command bodies, and flow values appear in query strings.

- [ ] **Step 3: Normalize record times at the action/application boundary**

Keep form strings as wall-time strings until `UserScope.timezone` is known. Convert through the shared Temporal helper and pass UTC ISO instants to domain/repository commands. Format edit/default values back through the same timezone. Represent repeated-time choice explicitly:

```ts
type WallTimeDisambiguation = "earlier" | "later";

type LocalRecordTime = {
  value: string;
  disambiguation?: WallTimeDisambiguation;
};
```

- [ ] **Step 4: Remove health values from URLs and history**

Replace `method="get"` step transitions and query-building redirects with client state persisted by pathname. What-if returns only a destination route and stores the draft before navigation:

```ts
sessionStorage.setItem(
  `record-draft:${pathname}`,
  JSON.stringify({ schemaVersion: 1, draft }),
);
router.push(pathname);
```

- [ ] **Step 5: Complete Record Hub CRUD**

Load the existing record id and editable values for every category. Expose add/edit/delete controls; edits submit the existing id, and deletes use the existing application use case with confirmation. Never put the id or values in the URL.

- [ ] **Step 6: Include old and new dates in recomputation**

Capture the owned pre-update entity before mutation and union both rolling ranges:

```ts
const affectedDates = uniqueSorted([
  ...affectedAnalysisDates(previous.localDate),
  ...affectedAnalysisDates(updated.localDate),
]);
```

- [ ] **Step 7: Hash the complete normalized request and recover PostgreSQL races outside the failed transaction**

```ts
const requestHash = hashCanonicalJson({
  operation,
  idempotencyKey,
  command: normalizedCommand,
});
```

Move winner-receipt lookup to an outer application boundary that can create a fresh repository/client after the failed transaction has rolled back. Do not query through the aborted transaction client after `P2002`.

- [ ] **Step 8: Verify and commit**

```powershell
npm run test:run -- tests/unit/zoned-date-time.test.ts tests/integration/record-service.test.ts tests/integration/mutation-receipt.test.ts tests/component/intake-flows.test.tsx tests/component/record-hub.test.tsx tests/unit/analyze-what-if-action.test.ts
npm run test:e2e -- tests/e2e/record-crud.spec.ts
git add src/shared/time src/modules/records 'src/app/(app)/record' 'src/app/(app)/analyze' tests
git commit -m "fix: make direct records timezone safe and private"
```

---

### Task 5: Restore Baseline, Analysis, Readiness, Sleep Impact, and Today contracts

**Files:**
- Modify: `src/modules/analysis/domain/types.ts`
- Modify: `src/modules/analysis/domain/schemas.ts`
- Modify: `src/modules/analysis/domain/calculate-baseline.ts`
- Modify: `src/modules/analysis/domain/calculate-readiness.ts`
- Modify: `src/modules/analysis/domain/calculate-sleep-impact.ts`
- Modify: `src/modules/analysis/application/ports.ts`
- Modify: `src/modules/analysis/application/recalculate-analysis.ts`
- Modify: `src/modules/analysis/application/get-today-view-model.ts`
- Modify: `src/modules/analysis/infrastructure/prisma-analysis-repository.ts`
- Modify: `src/modules/analysis/ui/today-screen.tsx`
- Test: `tests/unit/baseline.test.ts`
- Test: `tests/unit/readiness.test.ts`
- Test: `tests/unit/sleep-impact.test.ts`
- Test: `tests/unit/versioned-json.test.ts`
- Test: `tests/unit/today-view-model.test.ts`
- Test: `tests/integration/analysis-recalculation.test.ts`
- Test: `tests/component/today.test.tsx`

**Interfaces:**
- Consumes: normalized records and affected dates from Task 4.
- Produces: persisted validated `BaselineSnapshot`, persisted validated `AnalysisSnapshot`, explicit valid/stale/error snapshot states, and Today regions built from parsed results rather than persistence entities.

- [ ] **Step 1: Add RED tests for every missing analysis contract**

```ts
it("returns a readiness score when only regularity is missing", () => {
  expect(calculateReadiness({
    sleepDuration: 80,
    regularity: null,
    caffeine: 60,
    phone: 70,
    mealExercise: 90,
  })).toEqual({ score: 76, missingFields: ["regularity"] });
});

it("excludes invalid calendar dates from the baseline", () => {
  expect(calculateBaseline(inputWithLocalDate("2026-13-40")).sampleCount).toBe(2);
});

it("places a missing exposure in neither Sleep Impact cohort", () => {
  expect(classifySleepImpactRow(rowWithMissingCaffeine())).toEqual({
    exposed: false,
    unexposed: false,
  });
});

it("uses last-good as stale and corrupt-without-fallback as error", async () => {
  await expect(getTodayViewModel(scope, repositoryWithCorruptCurrentAndGoodFallback()))
    .resolves.toMatchObject({ readiness: { state: "stale" } });
  await expect(getTodayViewModel(scope, repositoryWithOnlyCorruptCurrent()))
    .resolves.toMatchObject({ readiness: { state: "error" } });
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm run test:run -- tests/unit/baseline.test.ts tests/unit/readiness.test.ts tests/unit/sleep-impact.test.ts tests/unit/versioned-json.test.ts tests/unit/today-view-model.test.ts tests/integration/analysis-recalculation.test.ts tests/component/today.test.tsx
```

Expected RED: invalid dates count as valid, missing regularity nulls readiness, missing exposures become unexposed, Baseline is not persisted, and Today dereferences the entity as if it were the result.

- [ ] **Step 3: Share one missing-field order and validate real local dates**

Export a single tuple from the analysis schema/types and consume it in both engine and parsing code:

```ts
export const READINESS_FIELD_ORDER = [
  "sleepDuration",
  "regularity",
  "caffeine",
  "phone",
  "mealExercise",
] as const;
```

Validate `localDate` by constructing `Temporal.PlainDate.from(value)` and confirming the normalized string equals the input.

- [ ] **Step 4: Persist and validate Baseline with the same envelope discipline as Analysis**

Add read/write repository methods for:

```ts
type BaselineEnvelope = {
  schemaVersion: 1;
  baseline: BaselineResult;
};
```

Parse with Zod and enforce 64 KiB before insert and after read. `recalculateAnalysis` saves/supersedes the Baseline and uses the validated entity id in the Analysis calculation.

- [ ] **Step 5: Repair readiness and Sleep Impact semantics**

Return `null` only for missing sleep duration. Re-normalize every other observed component. Classify cohorts using the approved thresholds: caffeine residual at target bed `>= 50 mg`, phone within 60 minutes, alcohol present, meal within 180 minutes, and exercise within 120 minutes. Rows lacking the relevant observation go to neither cohort. Keep domain inputs in minutes and update any fixture that incorrectly supplies hours.

- [ ] **Step 6: Separate persistence entities from parsed Today results**

Use an explicit state:

```ts
type SnapshotState =
  | { status: "ready"; entity: AnalysisSnapshotEntity; result: AnalysisResult }
  | { status: "stale"; entity: AnalysisSnapshotEntity; result: AnalysisResult }
  | { status: "insufficient" }
  | { status: "error"; code: "CORRUPT_ANALYSIS_SNAPSHOT" | "ANALYSIS_UNAVAILABLE" };
```

Every Today region reads `state.result`, never `entity` fields as if flattened. Query PlanDay with both `localDate` and the user's timezone.

- [ ] **Step 7: Verify and commit**

```powershell
npm run test:run -- tests/unit/baseline.test.ts tests/unit/readiness.test.ts tests/unit/sleep-impact.test.ts tests/unit/versioned-json.test.ts tests/unit/today-view-model.test.ts tests/integration/analysis-recalculation.test.ts tests/component/today.test.tsx
git add src/modules/analysis tests/unit tests/integration tests/component/today.test.tsx
git commit -m "fix: restore analysis snapshot contracts"
```

---

### Task 6: Repair Planner rerouting, timezone rendering, and narration semantics

**Files:**
- Modify: `src/modules/planner/domain/types.ts`
- Modify: `src/modules/planner/domain/generate-reroute-proposal.ts`
- Modify: `src/modules/planner/application/ports.ts`
- Modify: `src/modules/planner/application/evaluate-rerouting.ts`
- Modify: `src/modules/planner/application/create-schedule-advice.ts`
- Modify: `src/modules/planner/application/get-plan-view-model.ts`
- Modify: `src/modules/planner/infrastructure/prisma-planner-repository.ts`
- Modify: planner UI time-rendering components
- Modify: `src/modules/narration/domain/types.ts`
- Modify: `src/modules/narration/domain/validate-narration.ts`
- Test: `tests/unit/rerouting.test.ts`
- Test: `tests/integration/rerouting-service.test.ts`
- Test: `tests/integration/create-schedule-advice.test.ts`
- Test: `tests/unit/narration-validation.test.ts`
- Test: `tests/component/plan-screen.test.tsx`
- Test: `tests/component/narration-retry.test.tsx`

**Interfaces:**
- Consumes: validated Baseline/Analysis results and user timezone from Task 5.
- Produces: reroute identity over active plan content/revision, future-only conflict evaluation, timezone-explicit ViewModels, and metric-id/value-aware narration validation.

- [ ] **Step 1: Add RED reroute, timezone, and narration tests**

```ts
it("changes reroute identity when an active PlanDay revision changes", async () => {
  const first = await evaluateRerouting(scope, repositoryWithRevision("rev-1"), records, trigger);
  const second = await evaluateRerouting(scope, repositoryWithRevision("rev-2"), records, trigger);
  expect(second.adviceId).not.toBe(first.adviceId);
});

it("does not reroute a past active day from an old record", async () => {
  await expect(evaluateRerouting(scope, repositoryWithOnlyPastDays(), oldRecords, oldTrigger))
    .resolves.toEqual({ adviceId: null, pendingNarration: null });
});

it("formats plan times in the ViewModel timezone", () => {
  expect(formatPlanTime("2026-08-20T15:00:00.000Z", "Asia/Seoul")).toBe("00:00");
});

it("rejects a metric label paired with another metric's value", () => {
  expect(() => validateNarrationAgainstFacts(
    narration("카페인 점수는 72점입니다."),
    facts({ readiness: 72, caffeine: 55 }),
  )).toThrow("NARRATION_FACT_MISMATCH");
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm run test:run -- tests/unit/rerouting.test.ts tests/integration/rerouting-service.test.ts tests/integration/create-schedule-advice.test.ts tests/unit/narration-validation.test.ts tests/component/plan-screen.test.tsx tests/component/narration-retry.test.tsx
```

Expected RED: input hash ignores plan content/revision, past conflicts are evaluated, UI uses host timezone, and any number from any fact can satisfy any metric label.

- [ ] **Step 3: Include active plan identity in reroute inputs and evaluate only future days**

Expose active key/revision and stable active-day content in the repository entity. Hash a canonical structure:

```ts
const inputHash = hashCanonicalJson({
  schemaVersion: 1,
  planId: plan.id,
  revisionId: plan.revisionId,
  activeDays: activeFutureDays.map(toCanonicalPlanDay),
  triggerRecordId: trigger.recordId,
  triggerInstant: trigger.occurredAt,
  normalizedRecords,
});
```

Filter days by trigger instant before conflict detection and proposal generation.

- [ ] **Step 4: Keep injected planner tests from opening the default database**

Make narration dependencies explicit. A fully injected service with `narrationDependencies: null` must not call `getPrismaClient()`. Production wiring passes real narration dependencies.

- [ ] **Step 5: Carry timezone through the Plan ViewModel and render from it**

Add `timezone` to `PlanViewModel`; every planner formatter receives that value explicitly. Do not call `toLocaleTimeString` without a `timeZone` option.

- [ ] **Step 6: Validate narration facts semantically**

Build a stable map from allowed metric id/label to normalized display value. Verify each factual sentence against its named metric, not against the bag of all numeric tokens. Preserve the existing denylist and unsupported-number checks.

- [ ] **Step 7: Verify and commit**

```powershell
npm run test:run -- tests/unit/rerouting.test.ts tests/integration/rerouting-service.test.ts tests/integration/create-schedule-advice.test.ts tests/unit/narration-validation.test.ts tests/component/plan-screen.test.tsx tests/component/narration-retry.test.tsx
git add src/modules/planner src/modules/narration tests
git commit -m "fix: bind planner and narration to validated facts"
```

---

### Task 7: Repair Care, AppShell, responsive UI, privacy, and accessibility

**Files:**
- Create: `src/shared/ui/app-shell/app-shell.tsx`
- Modify: `src/shared/ui/app-shell/app-shell.module.css`
- Create or modify: one shared responsive presentation stylesheet/utility used by protected routes
- Modify: `src/app/(app)/layout.tsx`
- Modify: Care domain/application/repository/UI files
- Modify: account, onboarding, record, planner, and analysis form components that expose validation or submission status
- Modify: `src/modules/planner/ui/schedule-confirmation-dialog.tsx`
- Test: `tests/unit/routine-state.test.ts`
- Test: `tests/integration/care-session.test.ts`
- Test: `tests/component/care-screen.test.tsx`
- Test: `tests/component/care-tool-lifecycle.test.tsx`
- Test: `tests/component/account-screen.test.tsx`
- Test: new `tests/component/app-shell.test.tsx`
- Test: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes: `PlanDay.localDate` as wake date, user timezone, existing protected route list, and user-facing field errors.
- Produces: chronological Care behavior, elapsed-time timers, a protected AppShell with desktop/mobile navigation, and programmatically associated accessible state.

- [ ] **Step 1: Add RED Care, shell, breakpoint, and accessibility tests**

```ts
it("selects the wake-date PlanDay for tonight", async () => {
  const viewModel = await getCareViewModel(scope, repository, clockAt("2026-08-20T21:00:00+09:00"));
  expect(viewModel.planDay?.localDate).toBe("2026-08-21");
});

it("orders routine steps by their actual execution instant", () => {
  expect(buildRoutine(planDay).map((step) => step.kind)).toEqual([
    "caffeine",
    "meal",
    "exercise",
    "wind-down",
    "bed",
  ]);
});

it("derives timer progress from monotonic elapsed time", () => {
  expect(elapsedSeconds(1_000, 6_500)).toBe(5);
});

it("renders Account in desktop and mobile protected navigation", () => {
  render(<AppShell>{content}</AppShell>);
  expect(screen.getAllByRole("link", { name: "Account" })).toHaveLength(2);
});

it("associates a field error with its input", async () => {
  render(<ProfileForm action={rejectingAction} />);
  await user.click(screen.getByRole("button", { name: "저장" }));
  const input = screen.getByLabelText("닉네임");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("필수");
});
```

Add E2E viewport coverage at 641, 767, and 768 px and assert every primary CTA remains reachable. Add keyboard tests for dialog Escape/focus restoration, Care state text, and live submission announcements.

- [ ] **Step 2: Run and verify RED**

```powershell
npm run test:run -- tests/unit/routine-state.test.ts tests/integration/care-session.test.ts tests/component/care-screen.test.tsx tests/component/care-tool-lifecycle.test.tsx tests/component/account-screen.test.tsx tests/component/app-shell.test.tsx
```

Expected RED: Care selects the wrong date around bedtime, preserves declaration order, callback counts drive timers, no AppShell exists, and field errors are not associated.

- [ ] **Step 3: Repair Care day selection, ordering, and mutation guards**

Determine tonight's wake date from the current zoned time and target/active bed/wake interval. Fetch PlanDay by `{ userId, localDate, timezone }`. Sort routine steps by actual instant. Reject tool starts for closed/non-owned days just as routine completion does.

- [ ] **Step 4: Use monotonic elapsed time for every Care timer**

Capture `performance.now()` at start/resume, accumulate completed segments, and derive display/progress from elapsed time. Intervals only schedule rendering; callback count never defines duration. Preserve serialized start/stop and error propagation in the existing lifecycle tests.

- [ ] **Step 5: Add the protected AppShell and one responsive presentation boundary**

Render the same navigation model as desktop sidebar and mobile bottom navigation, including Account. Render content once. Use CSS as the single breakpoint authority so JS does not duplicate `767`:

```tsx
<aside className={styles.desktopNavigation}>...</aside>
<nav className={styles.mobileNavigation} aria-label="주요 메뉴">...</nav>
```

```css
.desktopNavigation { display: flex; }
.mobileNavigation { display: none; }

@media (max-width: 767px) {
  .desktopNavigation { display: none; }
  .mobileNavigation { display: flex; }
}
```

Consolidate duplicated JS breakpoint branches by rendering both responsive presentations and letting the shared CSS boundary select one.

- [ ] **Step 6: Associate errors and announce state**

For every form field with an error, add stable ids and both `aria-invalid` and `aria-describedby`. Add a polite live region for submit results. Expose progressbar values/names, textual Care current/done/upcoming state, and live timer changes. Add Escape handling to schedule confirmation and restore focus to the opener.

- [ ] **Step 7: Verify and commit**

```powershell
npm run test:run -- tests/unit/routine-state.test.ts tests/integration/care-session.test.ts tests/component/care-screen.test.tsx tests/component/care-tool-lifecycle.test.tsx tests/component/account-screen.test.tsx tests/component/app-shell.test.tsx
npm exec -- playwright test tests/e2e/accessibility.spec.ts --project=chromium
git add src/shared/ui 'src/app/(app)' src/modules tests
git commit -m "fix: restore protected shell and accessible care flows"
```

---

### Task 8: Make database, E2E, visual, and release gates fail closed

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/quality.yml`
- Modify: `.github/workflows/migrate-release.yml`
- Modify: `.github/workflows/release-preview.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `playwright.config.ts`
- Modify: `src/app/__e2e/setup/route.ts`
- Create: an authenticated E2E cleanup route/use case restricted to E2E mode
- Modify: `tests/visual/manifest.ts`
- Modify: `tests/visual/fixtures.ts`
- Modify: `tests/visual/runtime-frames.spec.ts`
- Create: `tests/unit/visual-baseline-contract.test.ts`
- Modify: `tests/e2e/production-smoke.spec.ts`
- Create: all manifest-declared committed visual baseline images under `tests/visual/__screenshots__/visual/`
- Test: `tests/integration/database-contract.test.ts`
- Test: `tests/unit/e2e-launch-config.test.ts`
- Test: `tests/unit/visual-baseline-contract.test.ts`
- Test: `tests/e2e/production-smoke.spec.ts`

**Interfaces:**
- Consumes: canonical migrations, pinned local CLIs, worker metadata, the visual manifest, and protected account/export/delete flows.
- Produces: parity tests that run against both adapters, worker-isolated browser data, mandatory visual coverage, and page-independent smoke cleanup.

- [ ] **Step 1: Add fail-closed RED tests**

```ts
it("requires one committed baseline per manifest frame", async () => {
  const missing = await missingVisualBaselines(visualManifest, baselineDirectory);
  expect(missing).toEqual([]);
});

it("uses a unique E2E identity for each worker namespace", () => {
  expect(e2eIdentity({ workerIndex: 0, namespace: "auth" }))
    .not.toEqual(e2eIdentity({ workerIndex: 1, namespace: "auth" }));
});
```

Extend production smoke so it waits for a download, parses the exported JSON envelope, signs out, signs back in, and registers API/use-case cleanup in `test.afterEach` independent of the current page.

- [ ] **Step 2: Run and verify RED**

```powershell
npm run verify:migrations
npm run test:run -- tests/integration/database-contract.test.ts tests/unit/e2e-launch-config.test.ts tests/unit/visual-baseline-contract.test.ts
```

Expected RED: SQLite history cannot initialize an empty database, visual baseline list is empty, and E2E identity is hard-coded.

- [ ] **Step 3: Run migrations, not `db push`, in contract gates**

Make SQLite and PostgreSQL jobs generate the provider-specific schema, apply the checked-in history from an empty database/schema, run `verify:migrations`, then execute the same repository/use-case contract. PostgreSQL CI must exercise CHECK constraints and migration drift verification.

- [ ] **Step 4: Pin local CLIs and remove floating execution**

Replace `auth@latest` and implicit Vercel downloads with manifest-resolved commands:

```yaml
- run: npm exec -- auth generate --yes --config src/shared/auth/auth.ts --output prisma/schema.auth-check.prisma
- run: npm exec -- vercel --version
```

- [ ] **Step 5: Isolate and clean browser workers**

Derive user id/email and PostgreSQL schema or row namespace from Playwright `workerIndex` plus test namespace. Pass it to the E2E setup route, validate it server-side, and clean it through a dedicated E2E-only authenticated boundary in `afterEach`/`afterAll`. Visual fixtures use the same cleanup contract.

- [ ] **Step 6: Make every visual frame mandatory**

Delete `hashFiles(...) != ''` skip logic. Validate manifest-to-baseline equality before Playwright comparison. Start the deterministic local browser stack, capture all declared frames with fixed clock/timezone/font/data, review the generated images, and commit exactly one baseline per manifest frame.

- [ ] **Step 7: Make production smoke verify auth persistence, export, and unconditional cleanup**

Use `Promise.all([page.waitForEvent("download"), clickExport()])`, parse and validate the downloaded versioned JSON, sign out and back in, and always call the cleanup API/use case from `test.afterEach` even if navigation failed.

- [ ] **Step 8: Run the complete local deterministic gate**

```powershell
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run verify:migrations
npm run verify:auth-schema
npm run test:e2e
npm run test:visual
```

Run SQLite and PostgreSQL contract suites against freshly initialized databases. If preview credentials are present, also run:

```powershell
npm run validate:release
npm run deploy:preview
```

If preview credentials are absent, record `preview production smoke: NOT RUN (credentials unavailable)` and do not report it as passing.

- [ ] **Step 9: Review and commit**

```powershell
git add .github package.json package-lock.json playwright.config.ts src/app/__e2e tests scripts prisma
git commit -m "test: make release gates fail closed"
```

---

## Final Verification Checklist

- [ ] `npm ci` exits 0 without an engine incompatibility warning.
- [ ] `npm run lint` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run test:run` exits 0 with zero failed files/tests.
- [ ] `npm run build` exits 0.
- [ ] SQLite adapter contract passes from an empty migrated database.
- [ ] PostgreSQL adapter contract passes from an empty migrated schema.
- [ ] Real Better Auth signup → session → signout → signin → protected route passes.
- [ ] Chromium E2E and accessibility tests pass with worker-isolated data.
- [ ] Every visual manifest frame has a committed baseline and strict comparison passes.
- [ ] Export download content, signout/signin, and page-independent cleanup are verified.
- [ ] Preview production smoke is either freshly passing with evidence or explicitly marked not run.
- [ ] Final whole-branch code review has no open Critical or Important findings.
