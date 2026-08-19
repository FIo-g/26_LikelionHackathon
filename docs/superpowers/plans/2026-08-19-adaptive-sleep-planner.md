# Adaptive Sleep Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma의 모든 활성 런타임 화면을 직접 입력 중심의 반응형 수면 플래너로 구현하고, Better Auth 사용자 격리와 SQLite 검증을 거쳐 PostgreSQL 기반 Vercel 운영 환경까지 완성한다.

**Architecture:** Next.js App Router 모듈형 모놀리스로 구성하며 UI → application use case → 순수 domain rule → 사용자 범위 repository → Prisma 순서로만 의존한다. `provisional-v1` 규칙 엔진이 모든 수치와 계획을 결정하고 OpenAI는 commit된 결과를 transaction 밖에서 설명한다.

**Tech Stack:** Node.js 22.12+, pnpm, Next.js App Router, React, TypeScript strict, Prisma ORM 7, SQLite, PostgreSQL, Better Auth, Zod, CSS Modules, Vitest, Testing Library, Playwright, OpenAI SDK

**Spec:** `docs/superpowers/specs/2026-08-19-adaptive-sleep-planner-design.md`

**Design Source:** [Adaptive Sleep Planner — Care UX](https://www.figma.com/design/VAAqQHPHafjYSlMXHshSEv/Adaptive-Sleep-Planner-%E2%80%94-Care-UX?node-id=32-111)

**Planning Context:** [Sleep Planner Notion](https://app.notion.com/p/Sleep_Planner-3c0a9c47121e808e964bfbadde0ebf51)

## Global Constraints

- Figma 활성 런타임 frame이 UI의 source of truth이고 Notion은 제품 의도 참고 자료다.
- Figma의 Archive / Earlier MVP drafts는 구현하지 않는다.
- 데스크톱과 모바일은 같은 route와 ViewModel을 사용한다.
- 현재 기록은 전부 직접 입력이다. HealthKit, Health Connect, 휴대폰 센서, 캘린더 실제 연동은 `coming-soon`으로만 표시한다.
- Figma의 “연동됨”과 “자동 입력” 문구는 현재 범위에서 “직접 입력 사용 중” 또는 “추후 지원”으로 바꾼다.
- Better Auth 이메일·비밀번호 인증과 Prisma adapter를 사용하며, 클라이언트가 보낸 userId는 신뢰하지 않는다.
- 사용자 소유 repository는 서버 session에서 만든 `UserScope` 없이는 생성할 수 없게 한다.
- Server Component는 read query를 호출하고 Client Component는 form, timer, chart interaction, Web Audio처럼 브라우저 상태가 필요한 영역에만 사용한다.
- 주요 일정과 Rerouting은 변경 전후 값을 보여준 뒤 사용자가 승인해야 plan을 변경한다.
- `provisional-v1` 계산은 순수 함수이며 LLM은 score, confidence, 날짜, cutoff를 변경할 수 없다.
- 모든 instant는 UTC `DateTime`, 날짜별 화면 키는 저장 당시 IANA timezone과 `YYYY-MM-DD` localDate다.
- JSON snapshot은 `{ schemaVersion, ...payload }` envelope, Zod 양방향 검증, 필드당 64 KiB 제한을 적용한다.
- 로컬 기능 검증은 SQLite, CI contract와 Vercel preview·production은 PostgreSQL을 사용한다.
- Prisma Next Early Access는 사용하지 않고 Prisma ORM 7 GA를 사용한다.
- Application query에서 DB enum, provider 전용 raw SQL, 대소문자와 null 정렬의 암묵 동작에 의존하지 않는다. PostgreSQL release migration의 명시적 CHECK constraint는 예외다.
- Better Auth 기본 scrypt 비밀번호 해시와 Secure, HttpOnly, SameSite=Lax cookie 정책을 유지한다.
- 애플리케이션 로그에 직접 입력값, 인증 정보, LLM prompt/response 본문을 남기지 않는다.
- 네이티브 앱, `apps/mobile`, 공개 `/api/v1`은 만들지 않는다.
- 의료 진단·치료·인과관계 단정과 대규모 ASMR 콘텐츠 플랫폼은 만들지 않는다.
- 각 task는 실패 테스트 → 최소 구현 → 통과 확인 → 관련 회귀 검증 → 커밋 순서로 실행한다.

## Locked File Structure

```text
.
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/
│   ├── prepare-prisma-schema.mjs
│   ├── seed-visual-fixtures.ts
│   └── verify-migrations.ts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (onboarding)/
│   │   ├── (app)/
│   │   └── api/auth/[...all]/route.ts
│   ├── generated/prisma/
│   ├── modules/
│   │   ├── onboarding/{domain,application,infrastructure,ui}/
│   │   ├── records/{domain,application,infrastructure,ui}/
│   │   ├── analysis/{domain,application,infrastructure,ui}/
│   │   ├── planner/{domain,application,infrastructure,ui}/
│   │   ├── narration/{domain,application,infrastructure}/
│   │   ├── care/{domain,application,infrastructure,ui}/
│   │   └── account/{domain,application,infrastructure,ui}/
│   ├── shared/{auth,config,connection,db,domain,time,ui,validation}/
│   └── styles/tokens.css
├── tests/{unit,integration,component,e2e,visual}/
├── prisma.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

`page.tsx`와 `actions.ts`는 transport와 조합만 담당한다. Prisma query는 `infrastructure`, 계산식은 `domain`, transaction orchestration은 `application`에만 둔다.

Figma Product Flow 번호는 01 인증·온보딩, 02 `/today`, 03 `/record`, 04 `/plan`, 05 `/analyze`, 06 `/care`·`/account`로 고정한다.

## Figma Coverage Matrix

| Figma source | Runtime implementation | Owning tasks | Acceptance gate |
|---|---|---:|---|
| Cover | 제품명·정보구조 참조, 별도 runtime route 없음 | 1–2 | metadata와 AppShell review |
| Foundations | 8개 색상 토큰, 타이포 hierarchy, 8px 간격, 14/21px radius | 2, 21 | token test + visual snapshots |
| Components / Routine Step | upcoming/current/done, 완료/취소 | 18 | component + Care E2E |
| Components / Care Tool | 호흡, 백색소음, 수면 가이드 카드와 실제 bounded interaction | 18 | fake-clock/audio tests + Care E2E |
| Components / Sync Status | manual/automatic, needs-input/unavailable/syncing/complete/error variants | 5, 9, 18, 19 | component variants; runtime은 manual만 활성 |
| Auth & Onboarding | Sign in, Connect, Sleep goal, Habits, Basic profile | 4–5 | auth/onboarding E2E + visual frames |
| Today | desktop/mobile readiness, data status, timeline, record summary | 10–11, 14 | Today E2E + two visual frames |
| Intake Flows | Sleep & Phone, Meal & Health, Caffeine, Alcohol의 모든 단계·확인 | 6–9 | category CRUD E2E + step-by-step visual frames |
| Record Hub | desktop/mobile 상태·추가·수정·삭제 | 8–9 | Record E2E + two visual frames |
| Plan | calendar, 직접 주요 일정, 2주 plan, AI advice, 승인 dialog, rerouting | 12–15, 17 | event/approval/reroute tests + two visual frames |
| Analyze | 지표, 추세, caffeine profile, What-if, 근거, data basis, AI report | 10, 15–17 | Analyze E2E + two visual frames |
| Care | desktop/mobile hero, sync summary, routine, 세 도구 | 18 | Care E2E + two visual frames |
| Account & Settings | profile, sleep goal, connection, manual rules, export/delete | 19–20 | Account/data E2E + two visual frames |
| Responsive Mobile | shared routes, five-tab bottom navigation, mobile priority rules | 2, 21 | 390×844 manifest + keyboard/axe checks |
| Product Flow | 01–06 route sequence and protected-entry behavior | 4–21 | production smoke journey |

`/sign-up`은 Figma에 독립 frame이 없으므로 Sign in shell을 재사용하는 기능 파생 화면이며 visual baseline 대상에서만 제외한다. Foundations, Components, Cover, Product Flow는 코드와 테스트의 구현 근거이고 runtime screenshot 대상은 아니다. Archive / Earlier MVP draft만 의도적으로 제외한다.

## Shared Contracts

Task 1~6에서 다음 계약을 만들고 이후 task에서 이름과 의미를 유지한다.

```ts
export type UserScope = Readonly<{
  userId: string;
  timezone: string;
}>;

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  uuid(): string;
}

export type DisplayState = "ready" | "insufficient" | "stale" | "error";
export type ConfidenceLevel = "insufficient" | "low" | "medium" | "high";

export type VersionedPayload<T extends object> = Readonly<{
  schemaVersion: 1;
} & T>;

export type Evidence = Readonly<{
  code: string;
  label: string;
  direction: "positive" | "negative" | "neutral";
  value: string | number | null;
  count: number | null;
}>;
```

---

### Task 1: Bootstrap the Next.js and test foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/shared/domain/contracts.ts`
- Test: `tests/component/root-layout.test.tsx`

**Interfaces:**
- Consumes: no application code
- Produces: `@/*` alias and package scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`, `test:visual`

- [ ] **Step 1: Write the failing root-layout test**

```tsx
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "@/app/layout";

it("renders Korean product metadata and its child content", () => {
  render(
    <RootLayout>
      <p>content</p>
    </RootLayout>,
  );

  expect(screen.getByText("content")).toBeInTheDocument();
  expect(metadata.title).toBe("Adaptive Sleep Planner");
  expect(metadata.description).toBe("내 기록으로 조정하는 수면 계획");
});
```

- [ ] **Step 2: Run the test and verify the missing-app failure**

Run: `pnpm vitest run tests/component/root-layout.test.tsx`

Expected: FAIL because the package and `src/app/layout.tsx` do not exist.

- [ ] **Step 3: Install dependencies and set exact scripts**

```bash
pnpm init
pnpm add next react react-dom zod clsx lucide-react
pnpm add -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @vitejs/plugin-react jsdom vite-tsconfig-paths @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Set these package fields without changing versions resolved into `pnpm-lock.yaml`:

```json
{
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12 <25" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test --project=chromium",
    "test:visual": "playwright test --project=visual"
  }
}
```

Create the workspace root explicitly so every later command resolves the same lockfile:

```yaml
packages:
  - "."
```

- [ ] **Step 4: Implement the minimal App Router shell**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adaptive Sleep Planner",
  description: "내 기록으로 조정하는 수면 계획",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

Configure Vitest with `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, and `vite-tsconfig-paths`. Configure Playwright with `baseURL: "http://127.0.0.1:3000"` and `webServer.command: "pnpm dev"`.

- [ ] **Step 5: Run bootstrap verification**

```bash
pnpm test:run tests/component/root-layout.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all four commands PASS.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts .gitignore .env.example src/app src/shared/domain/contracts.ts tests/component/root-layout.test.tsx
git commit -m "chore: bootstrap sleep planner web app"
```

### Task 2: Add semantic tokens, UI primitives, and responsive navigation

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/shared/ui/button.tsx`
- Create: `src/shared/ui/field.tsx`
- Create: `src/shared/ui/status-pill.tsx`
- Create: `src/shared/ui/card.tsx`
- Create: `src/shared/ui/app-shell/app-shell.tsx`
- Create: `src/shared/ui/app-shell/desktop-sidebar.tsx`
- Create: `src/shared/ui/app-shell/mobile-bottom-navigation.tsx`
- Create: `src/shared/ui/app-shell/app-shell.module.css`
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/component/ui-primitives.test.tsx`
- Test: `tests/component/app-shell.test.tsx`

**Interfaces:**
- Consumes: root layout from Task 1
- Produces: `Button`, `Field`, `StatusPill`, `Card`, `AppShell`, `APP_NAV_ITEMS`, semantic CSS variables

- [ ] **Step 1: Write failing primitive and navigation tests**

```tsx
it("prevents duplicate submission while a button is loading", () => {
  render(<Button isLoading>저장</Button>);
  expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "저장" })).toHaveAttribute("aria-busy", "true");
});

it("marks the active destination and exposes five mobile tabs", () => {
  render(<AppShell activePath="/record"><h1>기록</h1></AppShell>);
  expect(screen.getByRole("link", { name: "기록" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByLabelText("모바일 주 메뉴").querySelectorAll("a")).toHaveLength(5);
  expect(screen.getByRole("link", { name: "계정 설정" })).toHaveAttribute("href", "/account");
});
```

- [ ] **Step 2: Run tests and verify missing components**

Run: `pnpm test:run tests/component/ui-primitives.test.tsx tests/component/app-shell.test.tsx`

Expected: FAIL with unresolved shared UI modules.

- [ ] **Step 3: Define the one semantic token source**

```css
:root {
  --color-canvas: #f7f8fe;
  --color-surface: #ffffff;
  --color-surface-muted: #f3f4fa;
  --color-brand: #6d67df;
  --color-brand-subtle: #edecfd;
  --color-success-subtle: #ebf8f4;
  --color-sync-subtle: #f1f6fd;
  --color-text: #1c223e;
  --color-text-secondary-figma: #748098;
  --color-text-muted: #647089;
  --color-border: #dfe3ef;
  --color-brand-strong: #554fc8;
  --color-success: #317d67;
  --color-warning: #9a6b29;
  --color-danger: #ad4f4f;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --radius-sm: 14px;
  --radius-md: 21px;
  --radius-lg: 28px;
  --content-max: 1200px;
  --sidebar-width: 240px;
  --mobile-nav-height: 72px;
}
```

`--color-canvas`, `surface`, `brand`, `brand-subtle`, `success-subtle`, `sync-subtle`, `text`, `text-secondary-figma`는 Figma Foundations `12:2`의 여덟 토큰을 그대로 옮긴 값이고, muted surface·border·strong/status 색은 접근성 상태용 파생값이다. Figma secondary `#748098`은 canvas에서 일반 본문 AA 대비에 못 미치므로 큰 텍스트·비텍스트 장식에만 쓰고, 작은 보조 본문은 파생 `#647089`를 사용한다. 간격은 8px 계열, 기본 모서리는 Figma의 14px·21px를 사용하고 28px는 큰 dialog/hero용 2배 파생값으로만 쓴다. Task 21의 Figma calibration은 값만 바꿀 수 있고 변수 이름과 page-local raw color 금지 규칙은 유지한다.

- [ ] **Step 4: Implement primitive and shell contracts**

```ts
export const APP_NAV_ITEMS = [
  { href: "/today", label: "오늘" },
  { href: "/record", label: "기록" },
  { href: "/plan", label: "계획" },
  { href: "/analyze", label: "분석" },
  { href: "/care", label: "케어" },
  { href: "/account", label: "계정" },
] as const;

export type AppPath = (typeof APP_NAV_ITEMS)[number]["href"];
```

DesktopSidebar renders all six entries. MobileBottomNavigation renders the first five, while the Figma mobile top bar keeps a separate account/avatar link with accessible name “계정 설정”; Account is therefore reachable without inventing a sixth bottom tab. `Button` uses `isLoading`, `Field` connects errors with `aria-describedby`, and `StatusPill` accepts `neutral | success | warning | danger`.

- [ ] **Step 5: Verify the shared UI**

```bash
pnpm test:run tests/component/ui-primitives.test.tsx tests/component/app-shell.test.tsx
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit the shared UI**

```bash
git add src/styles src/shared/ui src/app/globals.css src/app/\(app\)/layout.tsx tests/component/ui-primitives.test.tsx tests/component/app-shell.test.tsx
git commit -m "feat: add responsive design foundation"
```

### Task 3: Configure Prisma 7 and Better Auth

**Files:**
- Create: `prisma.config.ts`
- Create: `prisma/schema.prisma`
- Create: `src/shared/config/env.ts`
- Create: `src/shared/db/database-provider.ts`
- Create: `src/shared/db/prisma.ts`
- Create: `src/shared/auth/auth-origin.ts`
- Create: `src/shared/auth/auth.ts`
- Create: `src/shared/auth/auth-client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Test: `tests/unit/database-provider.test.ts`
- Test: `tests/unit/auth-origin.test.ts`
- Test: `tests/integration/auth-handler.test.ts`

**Interfaces:**
- Consumes: ESM runtime and strict TypeScript from Task 1
- Produces: `prisma`, `auth`, `authClient`, `DatabaseProvider`, generated client at `src/generated/prisma`

- [ ] **Step 1: Write failing provider and exact-origin tests**

```ts
expect(providerForUrl("file:./dev.db")).toBe("sqlite");
expect(providerForUrl("postgresql://user:pass@localhost:5432/app")).toBe("postgresql");

expect(resolveAuthOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "sleep-main-team.vercel.app" })).toEqual({
  baseURL: "https://sleep-main-team.vercel.app",
  trustedOrigins: ["https://sleep-main-team.vercel.app"],
});
expect(resolveAuthOrigin({ VERCEL_ENV: "production", BETTER_AUTH_URL: "https://sleep.example.com" }).baseURL)
  .toBe("https://sleep.example.com");
expect(resolveAuthOrigin({ NODE_ENV: "development", BETTER_AUTH_URL: "http://127.0.0.1:3000" }).baseURL)
  .toBe("http://127.0.0.1:3000");
expect(() => resolveAuthOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "*.vercel.app" })).toThrow("INVALID_AUTH_ORIGIN");
```

- [ ] **Step 2: Run tests and verify missing infrastructure**

Run: `pnpm test:run tests/unit/database-provider.test.ts tests/unit/auth-origin.test.ts`

Expected: FAIL with missing provider and origin modules.

- [ ] **Step 3: Install and initialize the stable Prisma stack**

```bash
pnpm add @prisma/client@7 @prisma/adapter-better-sqlite3@7 @prisma/adapter-pg@7 pg dotenv better-auth @better-auth/prisma-adapter
pnpm add -D prisma@7 @types/better-sqlite3 @types/pg tsx
```

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}
```

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? env("DATABASE_URL") },
});
```

`resolveAuthOrigin` uses the exact `https://${VERCEL_URL}` only when `VERCEL_ENV === "preview"`; production uses the absolute HTTPS `BETTER_AUTH_URL`; local development permits only loopback HTTP. It rejects wildcards, credentials, paths, query strings, fragments, and non-HTTPS non-loopback origins and returns a one-item `trustedOrigins` array. `src/shared/config/env.ts` parses `DATABASE_URL`, `BETTER_AUTH_SECRET` (minimum 32 characters), and absolute `BETTER_AUTH_URL` with Zod. Create one driver adapter from the URL and cache the client and PostgreSQL pool per runtime isolate:

```dotenv
DATABASE_URL="file:./prisma/dev.db"
BETTER_AUTH_SECRET="replace-with-at-least-32-random-characters"
BETTER_AUTH_URL="http://127.0.0.1:3000"
AUTH_RATE_LIMIT_ENABLED="false"
```

Never copy the example secret into a deployed environment.

```ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const runtime = globalThis as typeof globalThis & {
  __sleepPlannerPrisma?: PrismaClient;
  __sleepPlannerPgPool?: Pool;
};

const provider = providerForUrl(env.DATABASE_URL);
const adapter = provider === "sqlite"
  ? new PrismaBetterSqlite3({ url: env.DATABASE_URL })
  : new PrismaPg(runtime.__sleepPlannerPgPool ??= new Pool({ connectionString: env.DATABASE_URL, max: 3 }));

export const prisma = runtime.__sleepPlannerPrisma ??= new PrismaClient({ adapter });
export const databaseProvider = provider;
```

Run `pnpm prisma generate` once so the auth configuration can import the client. Unit tests reset only their own generated SQLite file or PostgreSQL schema and call `prisma.$disconnect()` in teardown; application code never exposes the pool or logs its connection string.

- [ ] **Step 4: Generate Better Auth schema and add owned settings models**

Create `auth` with Prisma adapter, email/password enabled, `session.freshAge: 300`, a fixed session-cookie name, and the exact origin resolver. Keep Better Auth's generic delete-user endpoint disabled so it cannot bypass Task 20's email/phrase confirmation and atomic domain cleanup:

```ts
const resolvedOrigin = resolveAuthOrigin(process.env);

export const auth = betterAuth({
  appName: "Adaptive Sleep Planner",
  baseURL: resolvedOrigin.baseURL,
  trustedOrigins: resolvedOrigin.trustedOrigins,
  database: prismaAdapter(prisma, { provider: databaseProvider }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  session: { freshAge: 60 * 5, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: env.AUTH_RATE_LIMIT_ENABLED ?? (env.NODE_ENV === "production"),
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    cookiePrefix: "asp",
    cookies: { session_token: { name: "asp_session" } },
  },
  secret: env.BETTER_AUTH_SECRET,
});

export const AUTH_SESSION_COOKIE = "asp_session";
```

`databaseProvider` is `providerForUrl(env.DATABASE_URL)`. Export GET and POST through `toNextJsHandler(auth)` at `/api/auth/[...all]`. This release enables no OAuth provider, email-verification sender, password-reset sender, account linking, or generic user-deletion endpoint. Leave Better Auth's scrypt hashing and production Secure/HttpOnly/SameSite=Lax cookie defaults unchanged. The database-backed session remains authoritative; disabling cookie cache lets sensitive actions force one current-session lookup and makes custom account deletion clear exactly one documented auth cookie.

Run:

```bash
pnpm dlx auth@latest generate --yes --config src/shared/auth/auth.ts
```

Review the generated User, Session, Account, Verification, and RateLimit models, then add `UserProfile`, `SleepGoal`, `UserHabit`, and `Connection`. `Connection` fields are `type`, `mode`, `availability`, `state`, and nullable `lastSyncedAt`; unique key is `[userId, type]`. `AUTH_RATE_LIMIT_ENABLED` is an optional strict boolean: production defaults true, local development/test defaults false so parallel fixtures are not throttled. The auth integration test explicitly enables it, sends four invalid sign-in requests from one test IP, expects the fourth to return `429` with `X-Retry-After`, and clears only that test rate-limit key afterward.

Add `"postinstall": "prisma generate"`, `"db:generate": "prisma generate"`, `"db:migrate": "prisma migrate dev"`, and `"db:validate": "prisma validate"` to package scripts. Add `src/generated/prisma/` to `.gitignore`; deployments and tests regenerate it from the reviewed schema.

- [ ] **Step 5: Migrate and test the auth handler**

```bash
pnpm prisma validate
pnpm prisma migrate dev --name auth_and_settings
pnpm prisma generate
AUTH_RATE_LIMIT_ENABLED=true pnpm test:run tests/unit/database-provider.test.ts tests/unit/auth-origin.test.ts tests/integration/auth-handler.test.ts
pnpm typecheck
```

Expected: migration succeeds and auth route exports callable GET and POST handlers.

- [ ] **Step 6: Commit auth infrastructure**

```bash
git add package.json pnpm-lock.yaml prisma.config.ts prisma src/shared/config src/shared/db src/shared/auth src/app/api .env.example .gitignore tests/unit/database-provider.test.ts tests/unit/auth-origin.test.ts tests/integration/auth-handler.test.ts
git commit -m "feat: configure prisma and better auth"
```

### Task 4: Add authentication pages and server-side route guards

**Files:**
- Create: `src/shared/auth/entry-path.ts`
- Create: `src/shared/auth/require-session-user.ts`
- Create: `src/shared/auth/require-user-scope.ts`
- Create: `src/shared/auth/errors.ts`
- Create: `src/app/(auth)/auth-shell.tsx`
- Create: `src/app/(auth)/sign-in/sign-in-form.tsx`
- Create: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/app/(auth)/sign-up/sign-up-form.tsx`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(auth)/auth.module.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Test: `tests/unit/entry-path.test.ts`
- Test: `tests/integration/require-user-scope.test.ts`
- Test: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `auth`, `authClient`, `prisma`, `AppShell`
- Produces: `resolveEntryPath`, `safeReturnTo`, `requireSessionUserId(): Promise<string>`, `requireUserScope(): Promise<UserScope>`, sign-up/sign-in/sign-out flows

- [ ] **Step 1: Write failing entry routing and guard tests**

```ts
it.each([
  [{ userId: null, onboardingCompletedAt: null }, "/sign-in"],
  [{ userId: "u1", onboardingCompletedAt: null }, "/onboarding/connect"],
  [{ userId: "u1", onboardingCompletedAt: new Date("2026-08-19T00:00:00Z") }, "/today"],
] as const)("resolves the entry route", (context, expected) => {
  expect(resolveEntryPath(context)).toBe(expected);
});

expect(safeReturnTo("/record/caffeine?step=brand")).toBe("/record/caffeine?step=brand");
expect(safeReturnTo("https://attacker.example/steal")).toBe("/");
expect(safeReturnTo("//attacker.example/steal")).toBe("/");
```

The guard integration test asserts that no session throws `UnauthorizedError`, an authenticated onboarding user can obtain only its user ID, and `requireUserScope` refuses an incomplete profile but returns only its owned `{ userId, timezone }` after completion.

- [ ] **Step 2: Run tests and verify missing route code**

Run: `pnpm test:run tests/unit/entry-path.test.ts tests/integration/require-user-scope.test.ts`

Expected: FAIL with missing auth application modules.

- [ ] **Step 3: Implement entry routing and `UserScope` creation**

```ts
export type EntryPath = "/sign-in" | "/onboarding/connect" | "/today";

export function resolveEntryPath(input: Readonly<{
  userId: string | null;
  onboardingCompletedAt: Date | null;
}>): EntryPath {
  if (!input.userId) return "/sign-in";
  return input.onboardingCompletedAt ? "/today" : "/onboarding/connect";
}

export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  const url = new URL(value, "https://sleep-planner.invalid");
  return url.origin === "https://sleep-planner.invalid" ? `${url.pathname}${url.search}` : "/";
}
```

`requireSessionUserId()` calls `auth.api.getSession({ headers: await headers() })` and returns only `session.user.id`; onboarding layout/actions use this because timezone is not chosen until step 4. `requireUserScope()` calls that guard, loads the matching completed UserProfile, returns `{ userId, timezone }`, and throws `OnboardingIncompleteError` when profile/timezone is absent. The protected app layout maps that error to `/onboarding/connect` and maps `UnauthorizedError` to `/sign-in`; protected application code receives only a successful scope. Neither function accepts a userId argument.

- [ ] **Step 4: Implement Figma-derived sign-in and sign-up forms**

Sign-in passes only `safeReturnTo(searchParams.returnTo)` as `callbackURL`; its default is `/`. Sign-up uses `/onboarding/connect`. User-visible nickname remains the Basic profile field rather than adding an extra unsupported sign-up field. Both preserve email after failure, map Better Auth errors to Korean field messages, and disable double submission. Sign-up reuses AuthShell and is excluded from the visual manifest because Figma has no distinct active sign-up frame.

```ts
const signInResult = await authClient.signIn.email({ email, password, callbackURL: safeReturnTo(returnTo) });
if (signInResult.error) setFormError(toKoreanAuthError(signInResult.error.code));

const signUpResult = await authClient.signUp.email({
  email,
  password,
  name: email.split("@")[0],
  callbackURL: "/onboarding/connect",
});
if (signUpResult.error) setFormError(toKoreanAuthError(signUpResult.error.code));
```

- [ ] **Step 5: Verify auth behavior**

```bash
pnpm test:run tests/unit/entry-path.test.ts tests/integration/require-user-scope.test.ts
pnpm playwright test tests/e2e/auth.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 6: Commit authentication pages**

```bash
git add src/shared/auth src/app/page.tsx src/app/\(auth\) src/app/\(app\)/layout.tsx tests/unit/entry-path.test.ts tests/integration/require-user-scope.test.ts tests/e2e/auth.spec.ts
git commit -m "feat: add authentication entry flow"
```

### Task 5: Implement resumable four-step onboarding

**Files:**
- Create: `src/modules/onboarding/domain/types.ts`
- Create: `src/modules/onboarding/domain/schemas.ts`
- Create: `src/modules/onboarding/domain/calculate-sleep-duration.ts`
- Create: `src/shared/connection/status.ts`
- Create: `src/modules/onboarding/application/ports.ts`
- Create: `src/modules/onboarding/application/save-connect-step.ts`
- Create: `src/modules/onboarding/application/save-sleep-goal-step.ts`
- Create: `src/modules/onboarding/application/save-habits-step.ts`
- Create: `src/modules/onboarding/application/complete-onboarding.ts`
- Create: `src/modules/onboarding/infrastructure/prisma-onboarding-repository.ts`
- Create: `src/modules/onboarding/ui/onboarding-progress.tsx`
- Create: `src/modules/onboarding/ui/device-connect-option.tsx`
- Create: `src/modules/onboarding/ui/onboarding.module.css`
- Create: `src/app/(onboarding)/onboarding/layout.tsx`
- Create: `src/app/(onboarding)/onboarding/connect/page.tsx`
- Create: `src/app/(onboarding)/onboarding/connect/actions.ts`
- Create: `src/app/(onboarding)/onboarding/sleep-goal/page.tsx`
- Create: `src/app/(onboarding)/onboarding/sleep-goal/actions.ts`
- Create: `src/app/(onboarding)/onboarding/habits/page.tsx`
- Create: `src/app/(onboarding)/onboarding/habits/actions.ts`
- Create: `src/app/(onboarding)/onboarding/profile/page.tsx`
- Create: `src/app/(onboarding)/onboarding/profile/actions.ts`
- Test: `tests/unit/onboarding.test.ts`
- Test: `tests/integration/onboarding-persistence.test.ts`
- Test: `tests/component/onboarding-ui.test.tsx`
- Test: `tests/e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: authenticated user ID, `Clock`, UserProfile/SleepGoal/UserHabit/Connection models
- Produces: `OnboardingRepository`, four validated commands, persisted resume data, atomic `onboardingCompletedAt`

- [ ] **Step 1: Write failing domain and UI tests**

```ts
expect(calculateSleepDurationMinutes({ targetBedTime: "23:30", targetWakeTime: "07:00" })).toBe(450);
expect(sleepGoalSchema.safeParse({ targetBedTime: "23:00", targetWakeTime: "23:00" }).success).toBe(false);
```

```tsx
render(<OnboardingProgress currentStep={2} />);
expect(screen.getAllByRole("listitem")).toHaveLength(4);
expect(screen.getByLabelText("2단계, 현재 단계")).toBeVisible();

render(<DeviceConnectOption type="wearable" availability="coming-soon" selected={false} />);
expect(screen.getByText("준비 중")).toBeVisible();
expect(screen.queryByText("연동 완료")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run onboarding tests and verify they fail**

Run: `pnpm test:run tests/unit/onboarding.test.ts tests/integration/onboarding-persistence.test.ts tests/component/onboarding-ui.test.tsx`

Expected: FAIL with missing onboarding contracts and components.

- [ ] **Step 3: Define and implement the persistence contract**

```ts
export type OnboardingProgressData = Readonly<{
  connect: { selected: "manual" } | null;
  sleepGoal: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number } | null;
  habits: { caffeine: string; exercise: string; meal: string; phoneUsage: string } | null;
  profile: { nickname: string; timezone: string } | null;
}>;

export interface OnboardingRepository {
  saveConnect(input: { selected: "manual" }): Promise<void>;
  saveSleepGoal(input: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }): Promise<void>;
  replaceHabits(input: {
    caffeine: "none" | "sometimes" | "daily";
    exercise: "rare" | "weekly" | "frequent";
    meal: "early" | "mixed" | "late";
    phoneUsage: "low" | "medium" | "high";
  }): Promise<void>;
  complete(input: { nickname: string; timezone: string }): Promise<void>;
  getProgress(): Promise<OnboardingProgressData>;
}

export type OnboardingActionState =
  | { status: "idle"; values: Record<string, string> }
  | { status: "error"; values: Record<string, string>; fieldErrors: Record<string, string[]> }
  | { status: "success"; values: Record<string, string> };
```

Use a discriminated union so active code cannot construct a false sync combination:

```ts
export type ConnectionStatus =
  | { mode: "manual"; availability: "available"; state: "needs-input" | "complete"; lastSyncedAt: null }
  | { mode: "automatic"; availability: "coming-soon"; state: "unavailable"; lastSyncedAt: null };
```

All onboarding schemas are strict. The connect schema is `z.object({ selected: z.literal("manual") }).strict()`; only `manual + available + needs-input` is persisted. Sleep times use exact `HH:mm`, may not be equal, and must derive a 120–960 minute target. Nickname is trimmed to 1–40 characters and timezone must be a supported IANA zone. Wearable and phone are static, disabled `automatic + coming-soon + unavailable` ViewModels with null `lastSyncedAt`; no Server Action accepts them. Future `syncing | complete | error` automatic variants may exist in isolated component tests but no application use case can activate them. `complete` verifies connect, goal, and all four habit values in one transaction before setting profile and `onboardingCompletedAt`.

- [ ] **Step 4: Implement the four Figma routes and actions**

Each action performs `requireSessionUserId()` → Zod `safeParse` → user-ID-bound application use case → redirect. Connect shows disabled wearable/phone “준비 중” cards and the enabled “직접 입력으로 수면 플랜 시작하기” CTA. Sleep goal, Habits, and Basic profile show progress `2/4` through `4/4`, saved values, back navigation, field-level errors, and one primary CTA. A failed action returns submitted values; refresh loads persisted values; final success redirects to `/today`, where `requireUserScope()` can now resolve the saved timezone.

```ts
export async function submitSleepGoalAction(
  previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const userId = await requireSessionUserId();
  const parsed = sleepGoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionError(previous, formData, parsed.error.flatten().fieldErrors);
  await saveSleepGoalStep(userId, parsed.data);
  redirect("/onboarding/habits");
}
```

- [ ] **Step 5: Verify resume and completion behavior**

```bash
pnpm test:run tests/unit/onboarding.test.ts tests/integration/onboarding-persistence.test.ts tests/component/onboarding-ui.test.tsx
pnpm playwright test tests/e2e/onboarding.spec.ts --project=chromium
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all checks PASS, including refresh at every step and all-or-nothing final completion.

- [ ] **Step 6: Commit onboarding**

```bash
git add src/modules/onboarding src/shared/connection/status.ts src/app/\(onboarding\) tests/unit/onboarding.test.ts tests/integration/onboarding-persistence.test.ts tests/component/onboarding-ui.test.tsx tests/e2e/onboarding.spec.ts
git commit -m "feat: complete resumable onboarding"
```

### Task 6: Lock time, JSON, and direct-entry contracts

**Files:**
- Create: `src/shared/time/zoned-date-time.ts`
- Create: `src/shared/time/local-date.ts`
- Create: `src/shared/time/system-clock.ts`
- Create: `src/shared/domain/uuid-generator.ts`
- Create: `src/shared/validation/versioned-json.ts`
- Create: `src/shared/validation/errors.ts`
- Create: `src/modules/records/domain/types.ts`
- Create: `src/modules/records/domain/schemas.ts`
- Modify: `package.json`
- Test: `tests/unit/zoned-date-time.test.ts`
- Test: `tests/unit/versioned-json.test.ts`
- Test: `tests/unit/record-schemas.test.ts`

**Interfaces:**
- Consumes: `UserScope`, `VersionedPayload<T>`
- Produces: `parseZonedDateTime`, `possibleOffsetsForWallTime`, `wakeLocalDate`, `parseVersionedJson`, `RecordType`, validated create/update inputs

- [ ] **Step 1: Write failing DST, JSON-size, and input tests**

```ts
it("rejects a nonexistent DST wall time", () => {
  expect(() => parseZonedDateTime({
    localDate: "2026-03-08",
    localTime: "02:30",
    timezone: "America/New_York",
  })).toThrow("NONEXISTENT_OR_AMBIGUOUS_TIME");
});

it("accepts an explicit offset in a repeated DST hour", () => {
  expect(parseZonedDateTime({
    localDate: "2026-11-01",
    localTime: "01:30",
    timezone: "America/New_York",
    offsetMinutes: -300,
  }).toISOString()).toBe("2026-11-01T06:30:00.000Z");
});

it("rejects a versioned payload larger than 64 KiB", () => {
  expect(() => assertJsonSize({ schemaVersion: 1, text: "x".repeat(70_000) })).toThrow("JSON_TOO_LARGE");
});
```

- [ ] **Step 2: Run tests and verify missing contract failures**

Run: `pnpm test:run tests/unit/zoned-date-time.test.ts tests/unit/versioned-json.test.ts tests/unit/record-schemas.test.ts`

Expected: FAIL because time and record contract modules do not exist.

- [ ] **Step 3: Add Temporal and implement unambiguous conversion**

Run: `pnpm add @js-temporal/polyfill`

```ts
export type ZonedDateTimeInput = Readonly<{
  localDate: string;
  localTime: string;
  timezone: string;
  offsetMinutes?: number;
}>;

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function parseZonedDateTime(input: ZonedDateTimeInput): Date {
  try {
    const offset = input.offsetMinutes === undefined ? "" : formatOffset(input.offsetMinutes);
    const value = `${input.localDate}T${input.localTime}:00${offset}[${input.timezone}]`;
    const zoned = Temporal.ZonedDateTime.from(
      value,
      input.offsetMinutes === undefined
        ? { disambiguation: "reject" }
        : { disambiguation: "reject", offset: "reject" },
    );
    return new Date(zoned.epochMilliseconds);
  } catch {
    throw new TimeInputError();
  }
}
```

`possibleOffsetsForWallTime` resolves the same wall time with Temporal's `earlier` and `later` disambiguation, round-trips both candidates back into the requested zone, removes non-matching/duplicate instants, and returns zero, one, or two `{ offsetMinutes, label }` choices. `wakeLocalDate(endedAt, timezone)` converts the UTC instant to that IANA zone and returns its ISO date. A later profile timezone change never rewrites stored localDate or record timezone.

- [ ] **Step 4: Implement versioned JSON and record schemas**

```ts
export const MAX_JSON_BYTES = 64 * 1024;

export class TimeInputError extends Error {
  readonly code = "NONEXISTENT_OR_AMBIGUOUS_TIME";
  constructor() {
    super("NONEXISTENT_OR_AMBIGUOUS_TIME");
  }
}

export class JsonContractError extends Error {
  constructor(readonly code: "JSON_TOO_LARGE" | "UNKNOWN_SCHEMA_VERSION" | "INVALID_JSON_VALUE") {
    super(code);
  }
}

export function assertJsonSize(value: unknown): void {
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new JsonContractError("INVALID_JSON_VALUE");
  }
  if (json === undefined) throw new JsonContractError("INVALID_JSON_VALUE");
  if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) {
    throw new JsonContractError("JSON_TOO_LARGE");
  }
}

export function versionedPayloadSchema<T extends z.ZodRawShape>(payloadShape: T) {
  return z.object({ schemaVersion: z.literal(1), ...payloadShape }).strict();
}
```

Define `RecordType` as `sleep | caffeine | alcohol | meal | exercise | phone-usage | wellness`. Every schema is strict and rejects an end before a start, impossible future timestamps beyond five minutes of the injected Clock, and invalid IANA timezone names. Bound direct input as follows: brand/product/type text 1–80 characters, notes 0–500, caffeine 0–1000 mg, alcohol 0.25–20 servings, phone duration 0–1440 minutes, fatigue/stress/morning-fatigue integer 1–5, exercise heart rate null or 30–240, and any one elapsed session at most 1440 minutes. Sleep derives its DailyLog from wake localDate; the analysis engine may still exclude sessions outside its narrower 120–960 minute validity band without deleting the user's record.

```ts
export type RecordType =
  | "sleep"
  | "caffeine"
  | "alcohol"
  | "meal"
  | "exercise"
  | "phone-usage"
  | "wellness";

export type CreateRecordInput =
  | { type: "sleep"; startedAt: Date; endedAt: Date; morningFatigue: number; timezone: string }
  | { type: "caffeine"; brand: string; product: string; caffeineMg: number; consumedAt: Date; timezone: string }
  | { type: "alcohol"; alcoholType: string; servings: number; consumedAt: Date; timezone: string }
  | { type: "meal"; size: "small" | "medium" | "large"; eatenAt: Date; notes: string | null; timezone: string }
  | { type: "exercise"; exerciseType: string; intensity: "low" | "medium" | "high"; startedAt: Date; endedAt: Date; averageHeartRate: number | null; timezone: string }
  | { type: "phone-usage"; lastUseAt: Date; durationMinutes: number; timezone: string }
  | { type: "wellness"; localDate: string; fatigueLevel: number; stressLevel: number; timezone: string };

export type UpdateRecordInput = CreateRecordInput;
export type RecordEntity = CreateRecordInput & { id: string; userId: string; localDate: string };
export type SerializedRecord = Readonly<{
  id: string;
  userId: string;
  type: RecordType;
  localDate: string;
  fields: Readonly<Record<string, string | number | null>>;
}>;
```

All Date values become ISO UTC strings before entering SerializedRecord or a JSON field; Prisma DateTime remains Date at repository boundaries.

```ts
export const systemClock: Clock = { now: () => new Date() };
export const uuidGenerator: IdGenerator = { uuid: () => crypto.randomUUID() };
```

- [ ] **Step 5: Verify the shared contracts**

```bash
pnpm test:run tests/unit/zoned-date-time.test.ts tests/unit/versioned-json.test.ts tests/unit/record-schemas.test.ts
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit the shared contracts**

```bash
git add package.json pnpm-lock.yaml src/shared/time src/shared/domain/uuid-generator.ts src/shared/validation src/modules/records/domain tests/unit/zoned-date-time.test.ts tests/unit/versioned-json.test.ts tests/unit/record-schemas.test.ts
git commit -m "feat: define time and record contracts"
```

### Task 7: Add record storage, audit revisions, and idempotency

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/shared/db/transaction.ts`
- Create: `src/shared/validation/canonical-json.ts`
- Create: `src/modules/records/application/ports.ts`
- Create: `src/modules/records/infrastructure/prisma-record-repository.ts`
- Create: `src/modules/records/infrastructure/prisma-mutation-receipt-repository.ts`
- Create: `scripts/prepare-prisma-schema.mjs`
- Create: `docker-compose.test.yml`
- Test: `tests/integration/record-repository.test.ts`
- Test: `tests/integration/mutation-receipt.test.ts`
- Test: `tests/integration/database-contract.test.ts`

**Interfaces:**
- Consumes: Prisma client, `UserScope`, record schemas
- Produces: scoped `RecordRepository`, `MutationReceiptRepository`, direct ownership and audit persistence

- [ ] **Step 1: Write failing ownership and idempotency tests**

```ts
it("treats another user's record id as not found", async () => {
  const alice = repositoryFor(aliceScope);
  const bob = repositoryFor(bobScope);
  const record = await alice.create("caffeine", caffeineFixture);

  await expect(bob.update("caffeine", record.id, { caffeineMg: 80 })).rejects.toThrow("RECORD_NOT_FOUND");
  expect((await alice.findById("caffeine", record.id))?.caffeineMg).toBe(caffeineFixture.caffeineMg);
});

it("reuses one completed response for the same request hash", async () => {
  const first = await receipts.execute(command, work);
  const second = await receipts.execute(command, work);
  expect(second).toEqual(first);
  expect(work).toHaveBeenCalledTimes(1);
});
```

The same suite launches two concurrent calls with one key and asserts one mutation, rejects a reused key with a different request hash, and permits a new receipt after the prior row's 24-hour expiresAt.

- [ ] **Step 2: Run integration tests and verify schema failure**

Run: `pnpm test:run tests/integration/record-repository.test.ts tests/integration/mutation-receipt.test.ts`

Expected: FAIL because record tables and repositories do not exist.

- [ ] **Step 3: Add directly owned Prisma models and indexes**

Add `DailyLog`, `SleepSession`, `CaffeineEntry`, `AlcoholEntry`, `MealEntry`, `ExerciseEntry`, `PhoneUsageEntry`, `WellnessEntry`, `RecordRevision`, and `MutationReceipt`. Every user-owned model has direct `userId` and a User relation with `onDelete: Cascade`. SleepSession stores `sleepDate` equal to the wake localDate; PhoneUsageEntry and WellnessEntry also store their localDate for indexed daily reads.

Use these invariants:

```prisma
model DailyLog {
  id        String @id @default(uuid())
  userId    String
  localDate String
  timezone  String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, localDate, timezone])
  @@unique([id, userId])
  @@index([userId, timezone, localDate])
}

model MutationReceipt {
  id             String   @id @default(uuid())
  userId         String
  operation      String
  idempotencyKey String
  requestHash    String
  status         String
  resourceType   String?
  resourceId     String?
  responseJson   Json?
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, operation, idempotencyKey])
  @@index([userId, expiresAt])
}
```

Each entry uses a composite relation `[dailyLogId, userId] → DailyLog[id, userId]`. The triple DailyLog key permits the same calendar label in two travel timezones without rewriting history; current route queries always bind `scope.timezone`. RecordRevision stores operation, entity type/id, before and after versioned JSON, and changedAt.

Use an ephemeral local PostgreSQL contract service with no named volume:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: planner
      POSTGRES_PASSWORD: planner
      POSTGRES_DB: planner_test
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U planner -d planner_test"]
      interval: 5s
      timeout: 5s
      retries: 10
    tmpfs: ["/var/lib/postgresql/data"]
```

- [ ] **Step 4: Implement scope-bound repositories**

```ts
export type TransactionClient = Prisma.TransactionClient;

export type RecordRevisionInput = Readonly<{
  entityType: RecordType;
  entityId: string;
  operation: "create" | "update" | "delete";
  before: VersionedPayload<{ record: SerializedRecord }> | null;
  after: VersionedPayload<{ record: SerializedRecord }> | null;
  changedAt: Date;
}>;

export interface RecordRepository {
  findById(type: RecordType, id: string): Promise<RecordEntity | null>;
  create(type: RecordType, input: CreateRecordInput): Promise<RecordEntity>;
  update(type: RecordType, id: string, input: UpdateRecordInput): Promise<RecordEntity>;
  delete(type: RecordType, id: string): Promise<void>;
  appendRevision(input: RecordRevisionInput): Promise<void>;
}

export function createRecordRepository(db: TransactionClient, scope: UserScope): RecordRepository {
  return new PrismaRecordRepository(db, scope);
}
```

All ID queries include the bound `scope.userId`; nested updates first load the parent in the same transaction. MutationReceipt keeps completed responses for 24 hours. Acquisition first deletes only the same user's same operation/key row when `expiresAt <= clock.now()`, then attempts the unique insert; a unique race reloads the winner after its transaction resolves. It returns a validated stored response for the same hash and throws `IDEMPOTENCY_CONFLICT` for the same key with a different hash, so concurrent workers never execute the mutation twice.

```ts
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new JsonContractError("INVALID_JSON_VALUE");
  return value;
}

export function hashCanonicalJson(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) throw new JsonContractError("INVALID_JSON_VALUE");
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
```

- [ ] **Step 5: Migrate and verify storage**

```bash
pnpm prisma migrate dev --name direct_records
pnpm prisma generate
pnpm test:run tests/integration/record-repository.test.ts tests/integration/mutation-receipt.test.ts
docker compose -f docker-compose.test.yml up -d postgres
pnpm db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run tests/integration/database-contract.test.ts
docker compose -f docker-compose.test.yml down
pnpm prisma generate
pnpm typecheck
```

- [ ] **Step 6: Commit record storage**

```bash
git add package.json .gitignore prisma scripts/prepare-prisma-schema.mjs docker-compose.test.yml src/shared/db/transaction.ts src/shared/validation/canonical-json.ts src/modules/records/application/ports.ts src/modules/records/infrastructure tests/integration/record-repository.test.ts tests/integration/mutation-receipt.test.ts tests/integration/database-contract.test.ts
git commit -m "feat: persist scoped direct records"
```

`prepare-prisma-schema.mjs` accepts `--provider sqlite` or `--provider postgresql`, replaces exactly one datasource provider value with the requested value, writes gitignored `prisma/schema.active.prisma`, and preserves every model line byte-for-byte. The first contract test covers user isolation, DailyLog composite unique, versioned JSON round trip, cascade, and rollback. Every later schema task reruns this PostgreSQL contract before commit.

Add `"db:schema": "node scripts/prepare-prisma-schema.mjs"` to package scripts and add `prisma/schema.active.prisma` to `.gitignore`.

### Task 8: Implement record create, update, and delete use cases

**Files:**
- Create: `src/modules/records/application/create-record.ts`
- Create: `src/modules/records/application/update-record.ts`
- Create: `src/modules/records/application/delete-record.ts`
- Create: `src/modules/records/application/save-record-batch.ts`
- Create: `src/modules/records/application/delete-record-batch.ts`
- Create: `src/modules/records/application/affected-analysis-dates.ts`
- Create: `src/modules/records/application/record-service.ts`
- Create: `src/app/(app)/record/actions.ts`
- Test: `tests/unit/affected-analysis-dates.test.ts`
- Test: `tests/integration/record-service.test.ts`

**Interfaces:**
- Consumes: scoped record and receipt repositories, Clock, record schemas
- Produces: `RecordService.create/update/delete`, `affectedAnalysisDates`, safe Server Actions

- [ ] **Step 1: Write failing audit and recalculation-scope tests**

```ts
it("returns the rolling dates affected by a changed record", () => {
  expect(affectedAnalysisDates("2026-08-01", "2026-08-19")).toEqual([
    "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04",
    "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08",
    "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
    "2026-08-13", "2026-08-14",
  ]);
});
```

The integration test creates, updates, and deletes one caffeine entry, then asserts three RecordRevision rows with create/update/delete before-after envelopes and one effect per unique idempotency key. A second case saves meal, exercise, and wellness together, injects a failure on the second item, and verifies no entry, revision, or receipt survives.

- [ ] **Step 2: Run tests and verify missing service failure**

Run: `pnpm test:run tests/unit/affected-analysis-dates.test.ts tests/integration/record-service.test.ts`

Expected: FAIL because record application services do not exist.

- [ ] **Step 3: Implement one transactional mutation boundary**

```ts
export interface RecordMutationResult {
  recordId: string;
  recordType: RecordType;
  localDate: string;
  affectedLocalDates: readonly string[];
}

export type CreateRecordCommand = Readonly<{
  idempotencyKey: string;
  input: CreateRecordInput;
}>;

export type UpdateRecordCommand = Readonly<{
  idempotencyKey: string;
  recordId: string;
  input: UpdateRecordInput;
}>;

export type DeleteRecordCommand = Readonly<{
  idempotencyKey: string;
  recordId: string;
  recordType: RecordType;
}>;

export type SaveRecordItem = Readonly<{
  clientKey: string;
  recordId: string | null;
  input: CreateRecordInput;
}>;

export type SaveRecordBatchCommand = Readonly<{
  idempotencyKey: string;
  items: readonly SaveRecordItem[];
}>;

export type DeleteRecordBatchCommand = Readonly<{
  idempotencyKey: string;
  items: readonly { recordId: string; recordType: RecordType }[];
}>;

export type BatchRecordMutationResult = Readonly<{
  records: readonly { clientKey: string; recordId: string; recordType: RecordType; localDate: string }[];
  affectedLocalDates: readonly string[];
}>;

export type RecordActionState =
  | { status: "error"; values: Record<string, string>; fieldErrors: Record<string, string[]>; timeChoices?: readonly { field: string; offsetMinutes: number; label: string }[] }
  | { status: "success"; recordId: string };

export interface RecordService {
  create(command: CreateRecordCommand): Promise<RecordMutationResult>;
  update(command: UpdateRecordCommand): Promise<RecordMutationResult>;
  delete(command: DeleteRecordCommand): Promise<RecordMutationResult>;
  saveBatch(command: SaveRecordBatchCommand): Promise<BatchRecordMutationResult>;
  deleteBatch(command: DeleteRecordBatchCommand): Promise<BatchRecordMutationResult>;
}
```

Each method opens one DB transaction, acquires its MutationReceipt, writes the entry, appends RecordRevision, stores the response, and commits. `saveBatch` requires 1–7 unique `clientKey` values, validates every item before the transaction, then creates when `recordId` is null or updates the same-user record otherwise. An update first loads the record by both `recordId` and the parsed input's `recordType`; a missing target or type mismatch returns the same `RECORD_NOT_FOUND` result and writes nothing. `deleteBatch` likewise loads every target by the supplied ID/type pair and snapshots every same-user row before deleting any. Add integration cases for a cross-type ID and another user's ID. One failure rolls back every entry/revision/receipt in the batch. Single create/update/delete methods are thin wrappers around the same internal batch executor. Sleep uses the wake localDate. Other entries derive localDate from their event instant and saved timezone.

- [ ] **Step 4: Implement thin Server Actions**

Every action obtains `UserScope`, parses `FormData` with the matching schema, requires a client-generated UUID idempotency key, calls RecordService, then revalidates `/record`, `/today`, `/analyze`, and `/plan`. Compound intake actions parse the entire batch before calling `saveBatch`; they never issue sequential Server Actions. Error state retains submitted values and exposes field errors without returning stack traces.

```ts
export async function createRecordAction(formData: FormData): Promise<RecordActionState> {
  const scope = await requireUserScope();
  const parsed = createRecordFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return recordActionError(formData, parsed.error.flatten().fieldErrors);
  const result = await createRecordService(scope).create(parsed.data);
  for (const path of ["/record", "/today", "/analyze", "/plan"]) revalidatePath(path);
  return { status: "success", recordId: result.recordId };
}
```

- [ ] **Step 5: Verify record mutations**

```bash
pnpm test:run tests/unit/affected-analysis-dates.test.ts tests/integration/record-service.test.ts
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit record mutations**

```bash
git add src/modules/records/application src/app/\(app\)/record/actions.ts tests/unit/affected-analysis-dates.test.ts tests/integration/record-service.test.ts
git commit -m "feat: add audited record mutations"
```

### Task 9: Build Record Hub and all Figma intake flows

**Files:**
- Create: `src/modules/records/application/get-record-hub.ts`
- Create: `src/modules/records/ui/record-category-card.tsx`
- Create: `src/modules/records/ui/record-form-shell.tsx`
- Create: `src/modules/records/ui/record-confirmation.tsx`
- Create: `src/modules/records/ui/caffeine-flow.tsx`
- Create: `src/modules/records/ui/alcohol-flow.tsx`
- Create: `src/modules/records/ui/meal-health-form.tsx`
- Create: `src/modules/records/ui/sleep-phone-form.tsx`
- Create: `src/modules/records/ui/records.module.css`
- Create: `src/app/(app)/record/page.tsx`
- Create: `src/app/(app)/record/caffeine/page.tsx`
- Create: `src/app/(app)/record/alcohol/page.tsx`
- Create: `src/app/(app)/record/meal-health/page.tsx`
- Create: `src/app/(app)/record/sleep-phone/page.tsx`
- Test: `tests/component/record-hub.test.tsx`
- Test: `tests/component/intake-flows.test.tsx`
- Test: `tests/e2e/record-crud.spec.ts`

**Interfaces:**
- Consumes: RecordService actions and scoped record queries
- Produces: `RecordHubViewModel`, `EntryPresence`, all manual intake and confirmation screens

- [ ] **Step 1: Write failing state-label and flow tests**

```tsx
it.each([
  ["empty", "추가"],
  ["completed", "수정"],
] as const)("maps %s to %s", (presence, label) => {
  render(<RecordCategoryCard category="카페인" presence={presence} inputMode="manual" />);
  expect(screen.getByRole("link", { name: label })).toBeVisible();
});

it("never presents manual phone data as synchronized", () => {
  render(<RecordCategoryCard category="휴대폰" presence="completed" inputMode="manual" />);
  expect(screen.getByText("직접 입력 사용 중")).toBeVisible();
  expect(screen.queryByText("연동됨")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run component tests and verify missing UI**

Run: `pnpm test:run tests/component/record-hub.test.tsx tests/component/intake-flows.test.tsx`

Expected: FAIL because Record Hub and intake components do not exist.

- [ ] **Step 3: Implement the shared hub ViewModel and responsive shell**

```ts
export type EntryPresence = "empty" | "draft" | "completed" | "error";

export type RecordCategoryViewModel = Readonly<{
  type: RecordType;
  label: string;
  presence: EntryPresence;
  inputMode: "manual";
  summary: string | null;
  href: string;
}>;
```

Mobile renders the Figma full-screen flows. Desktop uses the same flow state and actions inside a modal or side panel. Desktop-derived intake screens are functional E2E targets but not direct Figma visual targets.

RecordFormShell stores the tab-scoped unsaved form draft in `sessionStorage` immediately before submit. The value is versioned, keyed by the exact intake pathname, expires after 30 minutes, and excludes password, email, and session values; never use `localStorage` or server logs. It keeps the form's random UUID idempotency key for an exact retry so a timeout, refresh, or reauthentication cannot duplicate a committed record; editing any value after an attempted submission generates a fresh key before the next submit. If a wall time has zero possible offsets, show “존재하지 않는 현지 시각입니다” and require a different time. If it has two, the error state returns the two UTC-offset labels and the form requires one explicit `offsetMinutes` choice before retrying. If the action returns `UNAUTHORIZED`, redirect with `` `/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}` `` and restore that exact flow after login through `safeReturnTo`. Clear the draft and key after successful commit, explicit cancel, or expiry.

- [ ] **Step 4: Implement each active intake sequence**

Caffeine: brand → menu/amount → confirmation. Alcohol: type → servings → confirmation. Meal & Health: meal, exercise, fatigue, stress. Sleep & Phone: start/end, morning fatigue, last phone use, duration. Caffeine and Alcohol call a single-record wrapper. Meal & Health atomically saves meal + exercise + wellness, while Sleep & Phone atomically saves sleep + phone usage through `saveBatch`. Editing passes existing IDs; category deletion uses `deleteBatch`. Every final submit returns to Record Hub only after the whole batch commits and then updates `EntryPresence`.

```ts
export const INTAKE_STEPS = {
  caffeine: ["brand", "menu-and-amount", "confirm"],
  alcohol: ["type", "amount", "confirm"],
  "meal-health": ["meal", "exercise-and-wellness", "confirm"],
  "sleep-phone": ["sleep", "phone", "confirm"],
} as const;
```

- [ ] **Step 5: Verify all categories through the browser**

```bash
pnpm test:run tests/component/record-hub.test.tsx tests/component/intake-flows.test.tsx
pnpm playwright test tests/e2e/record-crud.spec.ts --project=chromium
pnpm typecheck
```

Expected: a signed-in user can add, edit, delete, refresh, and see persisted state for every category.

- [ ] **Step 6: Commit Record Hub and intake UI**

```bash
git add src/modules/records src/app/\(app\)/record tests/component/record-hub.test.tsx tests/component/intake-flows.test.tsx tests/e2e/record-crud.spec.ts
git commit -m "feat: implement manual record flows"
```

### Task 10: Implement the `provisional-v1` analysis engine

**Files:**
- Create: `src/modules/analysis/domain/types.ts`
- Create: `src/modules/analysis/domain/schemas.ts`
- Create: `src/modules/analysis/domain/calculate-baseline.ts`
- Create: `src/modules/analysis/domain/calculate-readiness.ts`
- Create: `src/modules/analysis/domain/calculate-confidence.ts`
- Create: `src/modules/analysis/domain/calculate-sleep-impact.ts`
- Create: `src/modules/analysis/domain/caffeine-decay.ts`
- Create: `src/modules/analysis/domain/provisional-v1.ts`
- Test: `tests/unit/baseline.test.ts`
- Test: `tests/unit/readiness.test.ts`
- Test: `tests/unit/confidence.test.ts`
- Test: `tests/unit/sleep-impact.test.ts`

**Interfaces:**
- Consumes: normalized direct records, Clock
- Produces: `calculateAnalysis(input): AnalysisResult`, deterministic DataBasis and evidence

- [ ] **Step 1: Write failing boundary tests for every provisional rule**

```ts
it("marks fewer than three valid sleep days insufficient", () => {
  expect(calculateBaseline(twoValidNights).confidence).toBe("insufficient");
});

it("reweights present readiness inputs instead of treating missing values as zero", () => {
  const result = calculateReadiness({ sleepDuration: 80, regularity: 60, caffeine: null, phone: null, mealExercise: null });
  expect(result.score).toBe(72);
  expect(result.missingFields).toEqual(["caffeine", "phone", "mealExercise"]);
});

it("requires three nights in both sleep-impact cohorts", () => {
  expect(calculateSleepImpact({ exposed: [7.0, 6.5, 7.2], unexposed: [7.4, 7.1] }).confidence).toBe("insufficient");
});
```

- [ ] **Step 2: Run domain tests and verify missing engine failures**

Run: `pnpm test:run tests/unit/baseline.test.ts tests/unit/readiness.test.ts tests/unit/confidence.test.ts tests/unit/sleep-impact.test.ts`

Expected: FAIL because the domain engine does not exist.

- [ ] **Step 3: Define the immutable result contract**

```ts
export type NormalizedDailyRecords = Readonly<{
  localDate: string;
  sleepMinutes: number | null;
  bedMinuteOfDay: number | null;
  wakeMinuteOfDay: number | null;
  caffeine: readonly { consumedAt: string; caffeineMg: number }[];
  alcoholServings: number | null;
  lastPhoneUseAt: string | null;
  phoneDurationMinutes: number | null;
  exerciseMinutes: number | null;
  lastMealAt: string | null;
  fatigueLevel: number | null;
  stressLevel: number | null;
}>;

export type NormalizedAnalysisInput = Readonly<{
  localDate: string;
  timezone: string;
  goal: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number };
  days: readonly NormalizedDailyRecords[];
  computedAt: string;
}>;

export type DataBasis = Readonly<{
  periodStart: string;
  periodEnd: string;
  sampleCount: number;
  excludedCount: number;
  missingFields: readonly string[];
  completenessByCategory: Readonly<Record<string, number>>;
  sourceDistribution: Readonly<Record<"manual", number>>;
  computedAt: string;
  algorithmVersion: "provisional-v1";
  confidence: ConfidenceLevel;
}>;

export type AnalysisResult = Readonly<{
  readiness: number | null;
  confidence: ConfidenceLevel;
  metrics: Readonly<{
    sleepRhythmStability: number | null;
    phoneWindDown: number | null;
    caffeineSignal: number | null;
    sleepGoalAttainment: number | null;
  }>;
  dataBasis: DataBasis;
  evidence: readonly Evidence[];
  missingFields: readonly string[];
}>;
```

Define matching Zod schemas in `schemas.ts`, including `analysisResultSchema`, `dataBasisSchema`, and a `VersionedPayload` envelope. Use `.strict()` at every object boundary, finite numbers only, readiness/metrics bounded to 0–100, ordered unique `missingFields`, and evidence `code` values from an allowlist. The inferred Zod output must satisfy the TypeScript contract with `satisfies z.ZodType<AnalysisResult>` so persisted JSON cannot drift from the engine type.

- [ ] **Step 4: Implement exact provisional formulas**

Readiness weights are sleep duration 0.35, regularity 0.25, caffeine 0.20, phone 0.10, meal/exercise 0.10. Remove missing components, divide by the remaining weight, and clamp to 0–100. Sleep absence makes readiness null and confidence insufficient.

Use these component formulas:

- A valid sleep session lasts 120–960 minutes and has parseable start/end instants; invalid or overlapping duplicate sessions are excluded and increment `excludedCount`. Baseline duration is the median valid sleep minutes; baseline bed and wake are circular means of minute-of-day values. If a circular mean's resultant vector magnitude is below `1e-6`, choose the observed minute nearest the configured goal time so the result remains deterministic.
- Sleep-duration score is `clamp(sleepMinutes / targetDurationMinutes * 100, 0, 100)`.
- Regularity score is `clamp(100 - ((bedDeviationMinutes + wakeDeviationMinutes) / 2) * (100 / 120), 0, 100)`.
- Remaining caffeine at target bed is the sum of `mg * 0.5^(hoursSinceConsumption/5)`; caffeine score is `clamp(100 - remainingMg, 0, 100)`.
- Phone score is `clamp(minutesBetweenLastUseAndTargetBed / 60 * 100, 0, 100)`.
- Meal/exercise score is the mean of available binary cutoffs: meal at least 180 minutes before bed and exercise at least 120 minutes before bed.

```ts
const READINESS_WEIGHTS = {
  sleepDuration: 0.35,
  regularity: 0.25,
  caffeine: 0.20,
  phone: 0.10,
  mealExercise: 0.10,
} as const;

export function weightedAvailableScore(values: Record<keyof typeof READINESS_WEIGHTS, number | null>): number {
  const observed = Object.entries(values).filter((entry): entry is [keyof typeof READINESS_WEIGHTS, number] => entry[1] !== null);
  const numerator = observed.reduce((sum, [key, value]) => sum + value * READINESS_WEIGHTS[key], 0);
  const denominator = observed.reduce((sum, [key]) => sum + READINESS_WEIGHTS[key], 0);
  return Math.round(Math.min(100, Math.max(0, numerator / denominator)));
}
```

Confidence is `sampleScore*0.40 + completeness*0.30 + repeatability*0.20 + 0.6*0.10`, where `sampleScore=min(validSleepDays/14,1)`, completeness is the observed fraction of all seven direct categories (sleep/phone/meal/exercise/caffeine/alcohol/wellness), and repeatability is `clamp(1 - meanAbsoluteBedWakeDeviationMinutes/120, 0, 1)`. Under three valid sleep days is insufficient; otherwise `<0.35` low, `<0.70` medium, and `>=0.70` high.

Sleep Impact is mean sleep minutes on exposed nights minus mean sleep minutes on unexposed nights, requires at least three valid nights in both cohorts, and uses association language only. Build five provisional cohorts: caffeine remaining at bedtime `>= 50mg`, phone last use `< 60` minutes before bed, any alcohol, meal `< 180` minutes before bed, and exercise `< 120` minutes before bed. A night with missing factor input belongs to neither cohort. Persist factor key, two cohort counts, delta minutes or null, confidence, and evidence; never render “caused” or a treatment claim.

- [ ] **Step 5: Run deterministic tests**

```bash
pnpm test:run tests/unit/baseline.test.ts tests/unit/readiness.test.ts tests/unit/confidence.test.ts tests/unit/sleep-impact.test.ts
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit the provisional engine**

```bash
git add src/modules/analysis/domain tests/unit/baseline.test.ts tests/unit/readiness.test.ts tests/unit/confidence.test.ts tests/unit/sleep-impact.test.ts
git commit -m "feat: add provisional sleep analysis engine"
```

### Task 11: Persist analysis snapshots and build Today

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/records/application/record-service.ts`
- Create: `src/shared/domain/provisional-schedule-rules.ts`
- Create: `src/modules/analysis/application/ports.ts`
- Create: `src/modules/analysis/application/recalculate-analysis.ts`
- Create: `src/modules/analysis/infrastructure/prisma-analysis-repository.ts`
- Create: `src/modules/analysis/application/get-today-view-model.ts`
- Create: `src/modules/analysis/ui/readiness-card.tsx`
- Create: `src/modules/analysis/ui/data-status-card.tsx`
- Create: `src/modules/analysis/ui/preparation-timeline.tsx`
- Create: `src/modules/analysis/ui/record-status-summary.tsx`
- Create: `src/modules/analysis/ui/today-screen.tsx`
- Create: `src/modules/analysis/ui/today.module.css`
- Create: `src/app/(app)/today/page.tsx`
- Test: `tests/integration/analysis-recalculation.test.ts`
- Test: `tests/unit/today-view-model.test.ts`
- Test: `tests/component/today.test.tsx`
- Test: `tests/e2e/today.spec.ts`

**Interfaces:**
- Consumes: `calculateAnalysis`, affected local dates, scoped record data
- Produces: append-only BaselineSnapshot/AnalysisSnapshot/ImpactFactor, `TodayViewModel`, four independently degradable Today regions

- [ ] **Step 1: Write failing supersede and partial-state tests**

```ts
it("supersedes the current snapshot and appends a new result", async () => {
  const first = await service.recalculate(scope, ["2026-08-19"]);
  const second = await service.recalculate(scope, ["2026-08-19"]);
  expect(await snapshots.status(first[0].id)).toBe("superseded");
  expect(await snapshots.status(second[0].id)).toBe("current");
});
```

```tsx
it("shows stale analysis without hiding ready record status", () => {
  render(<TodayScreen viewModel={todayWithStaleReadiness} />);
  expect(screen.getByText("마지막 정상 분석을 표시합니다")).toBeVisible();
  expect(screen.getByText("오늘 기록 4개 완료")).toBeVisible();
});
```

- [ ] **Step 2: Run tests and verify missing persistence/UI failures**

Run: `pnpm test:run tests/integration/analysis-recalculation.test.ts tests/unit/today-view-model.test.ts tests/component/today.test.tsx`

Expected: FAIL because snapshot models, service, and Today components do not exist.

- [ ] **Step 3: Add snapshot models and scoped repository**

Add direct-user-owned `BaselineSnapshot`, `AnalysisSnapshot`, and `ImpactFactor`; both snapshot models persist their calculation timezone. Snapshot status is `current | superseded`; old rows receive `supersededAt` and are never overwritten. Nullable unique `BaselineSnapshot.currentKey` equals `${userId}:${timezone}` only while current, and nullable unique `AnalysisSnapshot.currentKey` equals `${userId}:${timezone}:${localDate}` only while current, preventing concurrent duplicate current rows on both providers while allowing unlimited null-key history. Add indexes `[userId, timezone, status, generatedAt]` and `[userId, timezone, localDate, status]`. JSON fields use the Task 6 envelope and size validation. `saveCurrent` serializes with `analysisResultSchema`; `findCurrent` and `findLastSuccessful` parse every row with the same schema and return a typed `CORRUPT_ANALYSIS_SNAPSHOT` failure instead of leaking malformed JSON into a ViewModel.

```ts
export type AnalysisSnapshotEntity = Readonly<{
  id: string;
  localDate: string;
  timezone: string;
  status: "current" | "superseded";
  result: AnalysisResult;
  generatedAt: Date;
  supersededAt: Date | null;
}>;

export interface AnalysisRepository {
  loadWindow(localDate: string, days: 14): Promise<NormalizedAnalysisInput>;
  supersedeCurrent(localDate: string, at: Date): Promise<void>;
  saveCurrent(localDate: string, result: AnalysisResult): Promise<{ snapshotId: string }>;
  findCurrent(localDate: string): Promise<AnalysisSnapshotEntity | null>;
  findLastSuccessful(localDate: string): Promise<AnalysisSnapshotEntity | null>;
}
```

- [ ] **Step 4: Wire recalculation into the record transaction**

`RecordService` passes its transaction client and bound scope to `recalculateAnalysis`. For changed date D, recalculate existing dates D through D+13 and current date when it falls in the same rolling range. On unexpected calculation failure, roll back the record mutation; a separate retry action keeps and displays the last committed snapshot.

```ts
return prisma.$transaction(async (tx) => {
  const records = createRecordRepository(tx, scope);
  const analysis = createAnalysisRepository(tx, scope);
  const mutation = await applyRecordMutation(records, command, clock);
  const snapshots = await recalculateAnalysis(analysis, mutation.affectedLocalDates, clock);
  await completeMutationReceipt(tx, scope, command.idempotencyKey, mutation);
  return { mutation, snapshots };
});
```

- [ ] **Step 5: Implement the region-based Today ViewModel**

```ts
export type RegionViewModel<T> = Readonly<{
  state: DisplayState;
  data: T | null;
  message: string | null;
  action: { label: string; href: string } | null;
}>;

export type ReadinessViewModel = Readonly<{
  score: number | null;
  confidence: ConfidenceLevel;
  label: string;
}>;

export type DataStatusViewModel = Readonly<{
  completedCategories: number;
  totalCategories: 7;
  missingLabels: readonly string[];
}>;

export type PreparationStepViewModel = Readonly<{
  key: string;
  label: string;
  scheduledAt: string;
  status: "upcoming" | "current" | "done";
}>;

export type PreparationSource =
  | Readonly<{ kind: "goal"; targetBedAt: string; caffeineCutoffAt: string; exerciseCutoffAt: string; mealCutoffAt: string; windDownAt: string }>
  | Readonly<{ kind: "plan-day"; planDayId: string; targetBedAt: string; caffeineCutoffAt: string; exerciseCutoffAt: string; mealCutoffAt: string; windDownAt: string }>;

export type RecordSummaryItem = Readonly<{
  type: RecordType;
  label: string;
  presence: EntryPresence;
  href: string;
}>;

export type TodayViewModel = Readonly<{
  localDate: string;
  readiness: RegionViewModel<ReadinessViewModel>;
  dataStatus: RegionViewModel<DataStatusViewModel>;
  preparationTimeline: RegionViewModel<PreparationStepViewModel[]>;
  recordSummary: RegionViewModel<RecordSummaryItem[]>;
}>;
```

No data is `insufficient`, not `error`. Recalculation failure is `stale` with the last successful snapshot and retry CTA. One failed region does not suppress the other three. Readiness exposes a named progressbar only when a numeric value exists; an insufficient card has text instead of a fake zero. PreparationTimeline is an ordered list with current/done text beyond color, and every missing record CTA is a real link to its exact intake. At this task, `getTodayViewModel` receives a goal-derived `PreparationSource` using the shared constants below; Task 12 imports the same object into its planner config, and Task 14 switches Today to an active PlanDay when one exists while retaining this source as fallback.

```ts
export const PROVISIONAL_SCHEDULE_RULES = Object.freeze({
  caffeineCutoffMinutesBeforeBed: 8 * 60,
  mealCutoffMinutesBeforeBed: 3 * 60,
  exerciseCutoffMinutesBeforeBed: 2 * 60,
  windDownMinutesBeforeBed: 60,
});
```

- [ ] **Step 6: Migrate and verify Today**

```bash
pnpm prisma migrate dev --name analysis_snapshots
pnpm prisma generate
pnpm test:run tests/integration/analysis-recalculation.test.ts tests/unit/today-view-model.test.ts tests/component/today.test.tsx
docker compose -f docker-compose.test.yml up -d postgres
pnpm db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run tests/integration/database-contract.test.ts
docker compose -f docker-compose.test.yml down
pnpm prisma generate
pnpm playwright test tests/e2e/today.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 7: Commit Today and snapshots**

```bash
git add prisma src/shared/domain/provisional-schedule-rules.ts src/modules/records/application/record-service.ts src/modules/analysis src/app/\(app\)/today tests/integration/analysis-recalculation.test.ts tests/unit/today-view-model.test.ts tests/component/today.test.tsx tests/e2e/today.spec.ts
git commit -m "feat: calculate and render daily readiness"
```

### Task 12: Implement the provisional planning domain and schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/modules/planner/domain/types.ts`
- Create: `src/modules/planner/domain/schemas.ts`
- Create: `src/modules/planner/domain/provisional-v1-config.ts`
- Create: `src/modules/planner/domain/generate-schedule-proposal.ts`
- Create: `src/modules/planner/application/ports.ts`
- Create: `src/modules/planner/infrastructure/prisma-planner-repository.ts`
- Test: `tests/unit/schedule-proposal.test.ts`
- Test: `tests/integration/planner-repository.test.ts`

**Interfaces:**
- Consumes: SleepGoal, BaselineSnapshot, Clock, UserScope
- Produces: planner models, `ScheduleProposal`, scoped `PlannerRepository`, deterministic day targets

- [ ] **Step 1: Write failing proposal-boundary and ownership tests**

```ts
it("moves bed and wake targets by at most fifteen minutes per day", () => {
  const proposal = generateScheduleProposal(scheduleContextFixture);
  for (let index = 1; index < proposal.days.length; index += 1) {
    expect(Math.abs(minutesBetween(proposal.days[index - 1].targetBedAt, proposal.days[index].targetBedAt))).toBeLessThanOrEqual(15);
    expect(Math.abs(minutesBetween(proposal.days[index - 1].targetWakeAt, proposal.days[index].targetWakeAt))).toBeLessThanOrEqual(15);
  }
});

it("uses low confidence and a goal fallback without a valid baseline", () => {
  const result = generateScheduleProposal(contextWithoutBaseline);
  expect(result.confidence).toBe("low");
  expect(result.evidence.map((item) => item.code)).toContain("insufficient-history");
});
```

- [ ] **Step 2: Run tests and verify missing planner failure**

Run: `pnpm test:run tests/unit/schedule-proposal.test.ts tests/integration/planner-repository.test.ts`

Expected: FAIL because planner models and domain functions do not exist.

- [ ] **Step 3: Add planner models with direct ownership**

Add `SpecialEvent`, `ScheduleAdvice`, `SleepPlan`, `PlanDay`, and `PlanRevision`; every model has direct `userId`. SpecialEvent stores immutable `startsAt`, derived `localDate`, and the IANA `timezone` used for that derivation. SleepPlan and PlanDay also persist the proposal timezone. ScheduleAdvice has nullable eventId/planId, `triggerType`, status, algorithmVersion, inputSnapshot, proposal, confidence, generatedAt. PlanRevision has `triggerType`, `triggerEntityType`, `triggerEntityId`, beforeSnapshot, afterSnapshot, and reason. PlanDay status is `draft | active | completed | superseded`.

```prisma
model PlanRevision {
  id                String   @id @default(uuid())
  userId            String
  planId            String
  triggerType       String
  triggerEntityType String?
  triggerEntityId   String?
  sourceAdviceId    String?  @unique
  beforeSnapshot    Json
  afterSnapshot     Json
  reason            String
  createdAt         DateTime @default(now())
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan              SleepPlan @relation(fields: [planId, userId], references: [id, userId], onDelete: Cascade)
  sourceAdvice      ScheduleAdvice? @relation(fields: [sourceAdviceId, userId], references: [id, userId])

  @@index([userId, planId, createdAt])
}
```

Use composite parent ownership relations where Prisma supports them, indexes `[userId, startsAt]`, `[userId, status, generatedAt]`, and `[userId, localDate, status]`. Add nullable unique `SleepPlan.activeKey` set to `userId` only while active, and nullable unique `PlanDay.activeKey` set to `${planId}:${localDate}` only while active; SQLite and PostgreSQL both permit multiple nulls, so this enforces one active plan per user and one active version per plan/date without blocking historical superseded rows. Add `@@unique([userId, triggerType, inputHash])` to ScheduleAdvice. Application validation enforces the trigger pair and ScheduleAdvice target invariant; Task 22 adds PostgreSQL CHECK constraints.

- [ ] **Step 4: Define and implement the planner contract**

```ts
export type PlanDayTarget = Readonly<{
  localDate: string;
  targetBedAt: string;
  targetWakeAt: string;
  caffeineCutoffAt: string;
  exerciseCutoffAt: string;
  mealCutoffAt: string;
  windDownAt: string;
}>;

export type ScheduleProposal = Readonly<{
  adjustmentStartsOn: string;
  eventWakeAt: string;
  days: readonly PlanDayTarget[];
  conflicts: readonly string[];
  confidence: "low" | "medium" | "high";
  evidence: readonly Evidence[];
  algorithmVersion: "provisional-v1";
}>;

export type SpecialEventInput = Readonly<{
  title: string;
  type: string;
  startsAt: string;
  desiredWakeAt: string | null;
  notes: string | null;
  timezone: string;
}>;

export type GeneratedAdviceInput = Readonly<{
  eventId: string | null;
  planId: string | null;
  triggerType: "event" | "reroute";
  inputHash: string;
  inputSnapshot: VersionedPayload<{
    timezone: string;
    goal: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number };
    baselineId: string | null;
    event: { id: string; type: string; startsAt: string; desiredWakeAt: string | null } | null;
    planId: string | null;
    triggerRecordId: string | null;
  }>;
  proposal: ScheduleProposal;
}>;

export type ScheduleAdviceEntity = GeneratedAdviceInput & Readonly<{
  id: string;
  status: "generated" | "accepted" | "dismissed" | "superseded" | "failed";
}>;

export type SleepPlanEntity = Readonly<{ id: string; status: "draft" | "active" | "completed" | "superseded" }>;
export type PlanDayEntity = PlanDayTarget & Readonly<{ id: string; planId: string; status: "draft" | "active" | "completed" | "superseded" }>;
export type AcceptedAdviceInput = Readonly<{ adviceId: string; before: VersionedPayload<{ days: readonly PlanDayTarget[] }>; after: VersionedPayload<{ days: readonly PlanDayTarget[] }> }>;

export interface PlannerRepository {
  createEvent(input: SpecialEventInput): Promise<{ eventId: string }>;
  saveGeneratedAdvice(input: GeneratedAdviceInput): Promise<{ adviceId: string }>;
  findAdvice(adviceId: string): Promise<ScheduleAdviceEntity | null>;
  findActivePlan(): Promise<SleepPlanEntity | null>;
  listActiveDays(planId: string): Promise<readonly PlanDayEntity[]>;
  acceptAdvice(input: AcceptedAdviceInput): Promise<{ planId: string; revisionId: string }>;
  dismissAdvice(adviceId: string): Promise<void>;
  supersedeGeneratedAdvice(targetId: string): Promise<void>;
}
```

Compute `inputHash` as SHA-256 over canonical JSON with recursively sorted object keys. Both snapshots include the immutable calculation timezone. Event advice snapshots only event id/type/start/desired wake and leaves plan/record null; reroute advice sets `planId` plus the triggering record ID and leaves event null. Title and notes are not calculation inputs. The hash and immutable inputSnapshot are used to supersede only stale generated advice after later record or goal changes.

Config imports `PROVISIONAL_SCHEDULE_RULES` and adds a 15-minute maximum daily movement. Use Temporal with the snapshot timezone to place the normal goal wake on the event's local date. If desiredWakeAt is present it is the event target; otherwise the target is the earlier instant of that normal goal wake and two hours before startsAt. Preserve target sleep duration when deriving bed time and derive each PlanDay `localDate` in the same timezone. Recurring generated goal times use Temporal `disambiguation: "compatible"`: a nonexistent spring-forward wall time moves forward by the gap, a repeated fall-back wall time chooses the earlier occurrence, and evidence includes `dst-adjusted` whenever the resolved wall time differs. Direct user-entered instants still follow Task 6's reject-or-explicit-offset rule. Start adjustment `ceil(abs(targetWake-goalWake)/15)` days before the event, capped at 14; when 14 days cannot reach the target, stop at the cap and append an `unreachable-with-daily-limit` conflict. The engine never reads the database or current system time directly.

- [ ] **Step 5: Migrate and verify the planning base**

```bash
pnpm prisma migrate dev --name planner_domain
pnpm prisma generate
pnpm test:run tests/unit/schedule-proposal.test.ts tests/integration/planner-repository.test.ts
docker compose -f docker-compose.test.yml up -d postgres
pnpm db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run tests/integration/database-contract.test.ts
docker compose -f docker-compose.test.yml down
pnpm prisma generate
pnpm typecheck
```

- [ ] **Step 6: Commit the planning base**

```bash
git add prisma src/modules/planner/domain src/modules/planner/application/ports.ts src/modules/planner/infrastructure tests/unit/schedule-proposal.test.ts tests/integration/planner-repository.test.ts
git commit -m "feat: add provisional planning domain"
```

### Task 13: Create major-event advice and the Plan screen

**Files:**
- Create: `src/modules/planner/application/create-schedule-advice.ts`
- Create: `src/modules/planner/application/get-plan-view-model.ts`
- Create: `src/modules/planner/ui/plan-calendar.tsx`
- Create: `src/modules/planner/ui/calendar-connection-card.tsx`
- Create: `src/modules/planner/ui/major-event-form.tsx`
- Create: `src/modules/planner/ui/schedule-advice-card.tsx`
- Create: `src/modules/planner/ui/two-week-plan-strip.tsx`
- Create: `src/modules/planner/ui/plan-screen.tsx`
- Create: `src/modules/planner/ui/plan.module.css`
- Create: `src/app/(app)/plan/page.tsx`
- Create: `src/app/(app)/plan/actions.ts`
- Test: `tests/integration/create-schedule-advice.test.ts`
- Test: `tests/component/plan-screen.test.tsx`
- Test: `tests/e2e/major-event.spec.ts`

**Interfaces:**
- Consumes: PlannerRepository, `generateScheduleProposal`, current goal/baseline, MutationReceipt
- Produces: `createScheduleAdvice(command)`, `PlanViewModel`, generated advice without plan mutation

- [ ] **Step 1: Write failing no-auto-apply and connection-copy tests**

```ts
it("creates an event and generated advice without creating a plan", async () => {
  const result = await service.createScheduleAdvice(eventCommand);
  expect(await repository.findAdvice(result.adviceId)).toMatchObject({ status: "generated" });
  expect(await repository.findPlanForEvent(result.eventId)).toBeNull();
});
```

```tsx
render(<CalendarConnectionCard availability="coming-soon" />);
expect(screen.getByText("캘린더 연동 준비 중")).toBeVisible();
expect(screen.getByRole("link", { name: "주요 일정 직접 입력" })).toBeVisible();
```

- [ ] **Step 2: Run tests and verify missing use case/UI**

Run: `pnpm test:run tests/integration/create-schedule-advice.test.ts tests/component/plan-screen.test.tsx`

Expected: FAIL because event creation and Plan components do not exist.

- [ ] **Step 3: Implement one event-to-advice transaction**

```ts
export type CreateScheduleAdviceCommand = Readonly<{
  idempotencyKey: string;
  title: string;
  type: string;
  startsAt: string;
  desiredWakeAt: string | null;
  notes: string | null;
}>;

export type CreateScheduleAdviceResult = Readonly<{
  eventId: string;
  adviceId: string;
  proposal: ScheduleProposal;
}>;

export type ScheduleAdviceViewModel = Readonly<{
  id: string;
  triggerType: "event" | "reroute";
  status: "generated" | "accepted" | "dismissed" | "superseded" | "failed";
  headline: string;
  proposal: ScheduleProposal;
}>;

export type PlanViewModel = Readonly<{
  calendarConnection: { availability: "coming-soon" };
  events: readonly { id: string; type: string; startsAt: string }[];
  advice: ScheduleAdviceViewModel | null;
  days: readonly PlanDayTarget[];
}>;
```

The transaction validates title 1–100 characters, type 1–40, notes at most 500, an event instant later than the injected Clock and no more than 365 days ahead, and an optional desired wake strictly before the event but no more than 24 hours earlier. It binds `timezone` from `UserScope`, writes SpecialEvent, computes one immutable proposal from owned goal/baseline/history, writes ScheduleAdvice `generated`, and completes MutationReceipt. It does not create SleepPlan, PlanDay, or PlanRevision.

```ts
const eventInput = { ...parsedEvent, timezone: scope.timezone };
const event = await plannerRepository.createEvent(eventInput);
const proposal = generateScheduleProposal({ goal, baseline, event: { ...eventInput, id: event.eventId } });
const inputSnapshot = {
  schemaVersion: 1 as const,
  timezone: scope.timezone,
  goal,
  baselineId: baseline?.id ?? null,
  event: { id: event.eventId, type: parsedEvent.type, startsAt: parsedEvent.startsAt, desiredWakeAt: parsedEvent.desiredWakeAt },
  planId: null,
  triggerRecordId: null,
};
const advice = await plannerRepository.saveGeneratedAdvice({
  eventId: event.eventId,
  planId: null,
  triggerType: "event",
  inputHash: hashCanonicalJson(inputSnapshot),
  inputSnapshot,
  proposal,
});
```

- [ ] **Step 4: Implement the full desktop Plan composition and mobile-preserving CTAs**

Desktop renders connection card, calendar, major-event form, generated advice, and two-week strip. If no accepted SleepPlan exists, the strip derives read-only next-14-day targets from SleepGoal so the screen is useful immediately after onboarding; it does not create plan rows. `MajorEventForm` uses the same 30-minute session draft/exact-retry idempotency-key rule as RecordFormShell, preventing a response timeout from duplicating an event. Mobile replaces the full grid with nearby agenda/day advice but keeps “주요 일정 추가”, “계획에 반영”, and “제안 닫기”. Dismiss transitions only the same-user generated advice to dismissed and never mutates a plan; accepted/superseded advice cannot be dismissed. The external connection control is disabled and points to direct entry.

```tsx
export function PlanScreen({ viewModel }: { viewModel: PlanViewModel }) {
  return (
    <>
      <CalendarConnectionCard availability={viewModel.calendarConnection.availability} />
      <PlanCalendar events={viewModel.events} />
      <MajorEventForm />
      {viewModel.advice ? <ScheduleAdviceCard advice={viewModel.advice} /> : null}
      <TwoWeekPlanStrip days={viewModel.days} />
    </>
  );
}
```

- [ ] **Step 5: Verify generated advice flow**

```bash
pnpm test:run tests/integration/create-schedule-advice.test.ts tests/component/plan-screen.test.tsx
pnpm playwright test tests/e2e/major-event.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 6: Commit major-event advice**

```bash
git add src/modules/planner/application src/modules/planner/ui src/app/\(app\)/plan tests/integration/create-schedule-advice.test.ts tests/component/plan-screen.test.tsx tests/e2e/major-event.spec.ts
git commit -m "feat: generate advice for major events"
```

### Task 14: Require confirmation before applying a schedule

**Files:**
- Create: `src/modules/planner/domain/diff-schedule-proposal.ts`
- Create: `src/modules/planner/application/accept-schedule-advice.ts`
- Create: `src/modules/planner/ui/schedule-confirmation-dialog.tsx`
- Modify: `src/modules/planner/ui/schedule-advice-card.tsx`
- Modify: `src/modules/analysis/application/get-today-view-model.ts`
- Modify: `src/app/(app)/plan/actions.ts`
- Test: `tests/unit/schedule-diff.test.ts`
- Test: `tests/integration/accept-schedule-advice.test.ts`
- Modify: `tests/e2e/major-event.spec.ts`
- Modify: `tests/e2e/today.spec.ts`

**Interfaces:**
- Consumes: generated ScheduleAdvice, MutationReceipt, PlannerRepository
- Produces: `ScheduleDiff`, `acceptScheduleAdvice`, immutable PlanRevision and versioned PlanDays

- [ ] **Step 1: Write failing confirmation and transaction tests**

```ts
it("returns only changed dates with before and after targets", () => {
  expect(diffScheduleProposal(currentDays, proposedDays)).toMatchObject([
    {
      localDate: "2026-08-21",
      before: { targetBedAt: "2026-08-21T14:30:00.000Z", targetWakeAt: "2026-08-21T22:30:00.000Z" },
      after: { targetBedAt: "2026-08-21T14:15:00.000Z", targetWakeAt: "2026-08-21T22:15:00.000Z" },
    },
  ]);
});
```

The integration test asserts generated → accepted, future old days → superseded, new days → active, one immutable PlanRevision, idempotent repeat response, and full rollback when revision insert fails.

- [ ] **Step 2: Run tests and verify missing acceptance behavior**

Run: `pnpm test:run tests/unit/schedule-diff.test.ts tests/integration/accept-schedule-advice.test.ts`

Expected: FAIL because diff and acceptance use cases do not exist.

- [ ] **Step 3: Implement the acceptance transaction**

```ts
export type AcceptScheduleAdviceCommand = Readonly<{
  adviceId: string;
  idempotencyKey: string;
}>;

export type AcceptScheduleAdviceResult = Readonly<{
  planId: string;
  revisionId: string;
  changedDates: readonly string[];
}>;

export type ScheduleDiff = Readonly<{
  localDate: string;
  before: PlanDayTarget | null;
  after: PlanDayTarget;
}>;
```

Within one transaction: load the advice with the bound scope and acquire the receipt. If it is already accepted, return the one revision with `sourceAdviceId = advice.id` without another write, even when a browser retry supplied a new key. Otherwise require generated status, create an active SleepPlan with `activeKey = scope.userId` if none exists (or reuse the current active plan), clear old future PlanDay active keys and mark those rows superseded, create proposal days with `${planId}:${localDate}` active keys, set advice accepted, append before/after PlanRevision with the unique sourceAdviceId, supersede competing generated advice, store the receipt response, then commit. A unique-key race reloads the winner and retries the transaction once; it never creates a second revision, active plan, or active day. Completed and historical days remain unchanged. The first revision uses `triggerEntityType: "special-event"` with the advice event ID; a reroute revision uses `triggerEntityType: "schedule-advice"` with the advice ID. Initial event advice keeps its event target; accepting it does not rewrite the advice into a reroute target. If there was no prior plan, `beforeSnapshot` is `{ schemaVersion: 1, days: [] }`.

- [ ] **Step 4: Implement explicit before/after confirmation UI**

The first “계획에 반영” click opens a dialog listing the number of changed days and each date's bed/wake before → after values, with an expandable row for caffeine/meal/exercise/wind-down cutoffs. A newly created date shows “기존 계획 없음” for `before`. Only the dialog confirm submits the action. Cancel leaves the advice generated and the current plan unchanged.

```tsx
<ScheduleConfirmationDialog
  title={`${diff.length}일의 계획이 변경됩니다`}
  changes={diff}
  confirmLabel="변경 확인 및 반영"
  onConfirm={() => acceptAction({ adviceId, idempotencyKey: crypto.randomUUID() })}
/>
```

After acceptance, revalidate `/plan`, `/today`, `/analyze`, and `/care`. `getTodayViewModel` reads today's same-user active PlanDay as its `PreparationSource`; if there is none, it uses the goal-derived source from Task 11. The Today E2E test accepts an advice, visits `/today`, and asserts the displayed cutoffs equal the accepted PlanDay rather than the old goal fallback.

- [ ] **Step 5: Verify approval-only mutation**

```bash
pnpm test:run tests/unit/schedule-diff.test.ts tests/integration/accept-schedule-advice.test.ts
pnpm playwright test tests/e2e/major-event.spec.ts --project=chromium
pnpm playwright test tests/e2e/today.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 6: Commit approval-only schedule application**

```bash
git add src/modules/planner src/modules/analysis/application/get-today-view-model.ts src/app/\(app\)/plan tests/unit/schedule-diff.test.ts tests/integration/accept-schedule-advice.test.ts tests/e2e/major-event.spec.ts tests/e2e/today.spec.ts
git commit -m "feat: require confirmation for plan changes"
```

### Task 15: Add Rerouting and non-persistent What-if

**Files:**
- Create: `src/modules/planner/domain/generate-reroute-proposal.ts`
- Create: `src/modules/planner/domain/preview-what-if.ts`
- Create: `src/modules/planner/application/evaluate-rerouting.ts`
- Create: `src/modules/planner/application/preview-what-if.ts`
- Modify: `src/modules/records/application/record-service.ts`
- Modify: `src/modules/analysis/application/get-today-view-model.ts`
- Modify: `src/modules/planner/ui/schedule-advice-card.tsx`
- Test: `tests/unit/rerouting.test.ts`
- Test: `tests/unit/what-if.test.ts`
- Test: `tests/integration/rerouting-service.test.ts`
- Test: `tests/e2e/rerouting-what-if.spec.ts`

**Interfaces:**
- Consumes: committed record mutation, current active plan, `generateScheduleProposal`
- Produces: approval-required reroute advice and read-only `WhatIfPreview`

- [ ] **Step 1: Write failing future-only and no-write tests**

```ts
it("reroutes only active days after the trigger instant", () => {
  const result = generateRerouteProposal(rerouteFixture);
  expect(result?.days.map((day) => day.localDate)).toEqual(["2026-08-22", "2026-08-23"]);
});

it("previews caffeine without repository writes", async () => {
  const result = await previewWhatIf(whatIfFixture, { calculateAnalysis });
  expect(result.kind).toBe("caffeine-added");
  expect(repositorySpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests and verify missing reroute/preview failures**

Run: `pnpm test:run tests/unit/rerouting.test.ts tests/unit/what-if.test.ts tests/integration/rerouting-service.test.ts`

Expected: FAIL because rerouting and What-if functions do not exist.

- [ ] **Step 3: Implement deterministic trigger rules**

Evaluate after a committed input violates a provisional active-day rule: caffeine after `caffeineCutoffAt`, meal after `mealCutoffAt`, exercise ending after `exerciseCutoffAt`, phone use after `windDownAt`, alcohol after `windDownAt`, or sleep wake drift over 30 minutes / duration shortfall over 45 minutes. Add/update/delete all re-evaluate from the resulting owned record set, so removing the trigger can supersede obsolete generated advice. RecordService calls this evaluation with the same transaction client after snapshot recalculation and before completing MutationReceipt. Supersede unaccepted advice whose input hash is now stale, then create `triggerType: "reroute"` ScheduleAdvice for trigger-time-future active days only when the plan actually conflicts. The service does not alter SleepPlan or PlanDay. Accepted PlanRevision rows remain immutable. Decline sets advice dismissed; acceptance reuses Task 14.

```ts
const reroute = generateRerouteProposal({
  trigger: mutation,
  activePlan,
  activeDays: activeDays.filter((day) => new Date(day.targetBedAt) > clock.now()),
  latestAnalysis,
});

await plannerRepository.supersedeGeneratedAdvice(activePlan.id);
if (reroute) {
  const inputSnapshot = {
    schemaVersion: 1 as const,
    timezone: scope.timezone,
    goal,
    baselineId,
    event: null,
    planId: activePlan.id,
    triggerRecordId: mutation.recordId,
  };
  await plannerRepository.saveGeneratedAdvice({
    eventId: null,
    planId: activePlan.id,
    triggerType: "reroute",
    inputHash: hashCanonicalJson(inputSnapshot),
    inputSnapshot,
    proposal: reroute,
  });
}
```

- [ ] **Step 4: Implement virtual What-if and its UI entry contract**

```ts
export type WhatIfPreview = Readonly<{
  kind: "caffeine-added";
  before: AnalysisResult;
  after: AnalysisResult;
  delta: number | null;
  actualRecordHref: "/record/caffeine";
}>;
```

What-if copies the current calculation input, adds one virtual caffeine event, and calls the same analysis engine. It creates no record, snapshot, advice, revision, or receipt. “실제 기록으로 추가” navigates with prefilled form state and saves only after normal confirmation.

- [ ] **Step 5: Connect reroute indicators**

Plan renders the generated reroute ScheduleAdviceCard. Today PreparationTimeline renders “계획 조정 제안 있음” and a Plan link. Neither entry point auto-applies changes.

```tsx
{viewModel.advice?.triggerType === "reroute" ? <ScheduleAdviceCard advice={viewModel.advice} /> : null}
{viewModel.hasRerouteAdvice ? <Link href="/plan">계획 조정 제안 있음</Link> : null}
```

- [ ] **Step 6: Verify Rerouting and What-if**

```bash
pnpm test:run tests/unit/rerouting.test.ts tests/unit/what-if.test.ts tests/integration/rerouting-service.test.ts
pnpm playwright test tests/e2e/rerouting-what-if.spec.ts --project=chromium
pnpm typecheck
```

The browser test starts from an accepted plan, saves a cutoff-crossing record, confirms that only a generated reroute card appears, cancels its confirmation dialog and proves the old plan remains, then accepts and proves only future days change. It also opens What-if, observes before/after without any record-count change, follows “실제 기록으로 추가”, cancels before final confirmation, and again asserts no persistent write.

- [ ] **Step 7: Commit Rerouting and What-if**

```bash
git add src/modules/planner src/modules/records/application/record-service.ts src/modules/analysis/application/get-today-view-model.ts tests/unit/rerouting.test.ts tests/unit/what-if.test.ts tests/integration/rerouting-service.test.ts tests/e2e/rerouting-what-if.spec.ts
git commit -m "feat: add approval-based plan rerouting"
```

### Task 16: Build Analyze from stored calculation facts

**Files:**
- Create: `src/modules/analysis/application/get-analyze-view-model.ts`
- Create: `src/modules/analysis/ui/metric-grid.tsx`
- Create: `src/modules/analysis/ui/sleep-trend-chart.tsx`
- Create: `src/modules/analysis/ui/caffeine-profile.tsx`
- Create: `src/modules/analysis/ui/explainability-card.tsx`
- Create: `src/modules/analysis/ui/data-basis-panel.tsx`
- Create: `src/modules/analysis/ui/analysis-report.tsx`
- Create: `src/modules/analysis/ui/analyze.module.css`
- Create: `src/app/(app)/analyze/page.tsx`
- Create: `src/app/(app)/analyze/actions.ts`
- Test: `tests/unit/analyze-view-model.test.ts`
- Test: `tests/component/analyze-screen.test.tsx`
- Test: `tests/e2e/analyze.spec.ts`

**Interfaces:**
- Consumes: current/last-good AnalysisSnapshot, ImpactFactors, ScheduleAdvice, What-if preview
- Produces: complete desktop Analyze and compressed but fully reachable mobile Analyze

- [ ] **Step 1: Write failing data-basis and copy tests**

```tsx
render(<DataBasisPanel dataBasis={analysisFixture.dataBasis} />);
expect(screen.getByText("2026-08-06–2026-08-19")).toBeVisible();
expect(screen.getByText("표본 10일")).toBeVisible();
expect(screen.getByText("provisional-v1")).toBeVisible();

render(<CaffeineProfile metric={analysisFixture.metrics.caffeineSignal} />);
expect(screen.getByText(/관찰된 신호/)).toBeVisible();
expect(screen.queryByText(/원인/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run tests and verify missing Analyze UI**

Run: `pnpm test:run tests/unit/analyze-view-model.test.ts tests/component/analyze-screen.test.tsx`

Expected: FAIL because Analyze query and components do not exist.

- [ ] **Step 3: Implement the immutable Analyze ViewModel**

```ts
export type MetricViewModel = Readonly<{
  key: "sleep-rhythm" | "phone-wind-down" | "caffeine-signal" | "sleep-goal";
  label: string;
  value: number | null;
  state: DisplayState;
}>;

export type TrendPoint = Readonly<{ localDate: string; sleepMinutes: number | null; goalMinutes: number }>;
export type CaffeineProfileViewModel = Readonly<{ signal: number | null; wording: "관찰된 신호"; whatIfEnabled: boolean }>;
export type EvidenceViewModel = Evidence;
export type ReportViewModel = Readonly<{ status: "pending" | "ready" | "template-fallback" | "failed"; headline: string; body: string; bullets: readonly string[] }>;

export type AnalyzeViewModel = Readonly<{
  state: DisplayState;
  metrics: readonly MetricViewModel[];
  trend: readonly TrendPoint[];
  caffeineProfile: CaffeineProfileViewModel;
  explainability: readonly EvidenceViewModel[];
  dataBasis: DataBasis;
  report: ReportViewModel;
  scheduleAdvice: ScheduleAdviceViewModel | null;
}>;
```

The query parses snapshot JSON with the version schema and never parses LLM text for metrics. Unknown or corrupt versions return stale/error with last-good facts.

- [ ] **Step 4: Implement Figma desktop and mobile information priority**

Desktop shows four metrics, two-week trend with goal line, caffeine profile and What-if, report, explainability, Data basis, and calendar-aware advice. Mobile shows two priority metrics and report first; “전체 지표·근거 보기” exposes all four, trend, caffeine, explainability, and Data basis. `SleepTrendChart` renders SVG as presentation only and pairs it with an accessible date/sleep/goal table; keyboard focus on a point exposes the same tooltip text as hover, and missing days are labeled rather than connected as zero. Status always has text/icon in addition to color. Every result displays “초기 추정 모델이며 의료 진단이 아닙니다.” and caffeine/Sleep Impact copy uses “패턴” or “관찰된 신호”. Analyze's plan-apply CTA calls the same Task 14 confirmation use case.

```tsx
<section aria-labelledby="analysis-title">
  <MetricGrid metrics={viewModel.metrics} mobileVisibleCount={2} />
  <AnalysisReport report={viewModel.report} />
  <div className={styles.desktopDetails}>
    <SleepTrendChart points={viewModel.trend} />
    <CaffeineProfile model={viewModel.caffeineProfile} />
    <ExplainabilityCard evidence={viewModel.explainability} />
    <DataBasisPanel dataBasis={viewModel.dataBasis} />
  </div>
  <details className={styles.mobileDetails}>
    <summary>전체 지표·근거 보기</summary>
    <SleepTrendChart points={viewModel.trend} />
    <CaffeineProfile model={viewModel.caffeineProfile} />
    <ExplainabilityCard evidence={viewModel.explainability} />
    <DataBasisPanel dataBasis={viewModel.dataBasis} />
  </details>
</section>
```

- [ ] **Step 5: Verify Analyze**

```bash
pnpm test:run tests/unit/analyze-view-model.test.ts tests/component/analyze-screen.test.tsx
pnpm playwright test tests/e2e/analyze.spec.ts --project=chromium
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit Analyze**

```bash
git add src/modules/analysis src/app/\(app\)/analyze tests/unit/analyze-view-model.test.ts tests/component/analyze-screen.test.tsx tests/e2e/analyze.spec.ts
git commit -m "feat: render explainable sleep analysis"
```

### Task 17: Add allowlisted OpenAI narration with deterministic fallback

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `package.json`
- Modify: `src/modules/analysis/application/recalculate-analysis.ts`
- Modify: `src/modules/planner/application/create-schedule-advice.ts`
- Modify: `src/modules/planner/application/evaluate-rerouting.ts`
- Modify: `src/modules/records/application/record-service.ts`
- Create: `src/modules/narration/domain/types.ts`
- Create: `src/modules/narration/domain/narration-schema.ts`
- Create: `src/modules/narration/domain/build-template-narration.ts`
- Create: `src/modules/narration/domain/validate-narration.ts`
- Create: `src/modules/narration/application/ports.ts`
- Create: `src/modules/narration/application/generate-narration.ts`
- Create: `src/modules/narration/infrastructure/openai-narration-provider.ts`
- Create: `src/modules/narration/infrastructure/prisma-narration-repository.ts`
- Create: `src/shared/time/with-timeout.ts`
- Test: `tests/unit/template-narration.test.ts`
- Test: `tests/unit/narration-validation.test.ts`
- Test: `tests/integration/generate-narration.test.ts`
- Test: `tests/unit/openai-input-allowlist.test.ts`
- Test: `tests/e2e/narration-fallback.spec.ts`

**Interfaces:**
- Consumes: committed AnalysisResult or ScheduleProposal only
- Produces: pending → ready/template-fallback Narration, `NarrationProvider`, safe Korean report text

- [ ] **Step 1: Write failing fallback and privacy tests**

```ts
it("uses a deterministic Korean fallback after provider failure", async () => {
  provider.generate.mockRejectedValue(new Error("timeout"));
  const result = await service.generate(narrationRequestFixture);
  expect(result.status).toBe("template-fallback");
  expect(result.output.headline).toBe("현재 기록으로 본 수면 준비 상태");
});

it("excludes identity, title, notes, and raw records from provider input", () => {
  const input = buildNarrationInput(privateFixture);
  const serialized = JSON.stringify(input);
  expect(serialized).not.toContain("user@example.com");
  expect(serialized).not.toContain("면접 회사 이름");
  expect(serialized).not.toContain("개인 메모");
  expect(serialized).not.toContain("session-token");
});

it("rejects a number or medical claim not present in immutable facts", () => {
  expect(validateNarrationAgainstFacts(
    { headline: "점수 97점", body: "카페인이 원인입니다.", bullets: [] },
    analysisFactsFixture,
  )).toEqual({ valid: false, code: "UNSUPPORTED_CLAIM" });
});
```

- [ ] **Step 2: Run tests and verify missing narration failure**

Run: `pnpm test:run tests/unit/template-narration.test.ts tests/unit/narration-validation.test.ts tests/integration/generate-narration.test.ts tests/unit/openai-input-allowlist.test.ts`

Expected: FAIL because narration modules and model do not exist.

- [ ] **Step 3: Add the exclusive-target Narration model**

Add direct `userId`, nullable `analysisSnapshotId`, nullable `scheduleAdviceId`, provider, model, inputHash, versioned output JSON, status, generatedAt, and retryCount. Repository creation validates that exactly one target ID is non-null. SQLite integration tests enforce the XOR invariant; Task 22 adds a PostgreSQL CHECK constraint.

Within the existing snapshot/advice transaction, insert a pending Narration row after numeric facts are saved. Recalculation creates narration only for the user's current localDate snapshot, not every historical date in the rolling window; initial event advice and reroute advice each receive one. Return pending requests from the transaction. Do not call a provider inside the transaction.

```ts
export type NarrationTarget =
  | { analysisSnapshotId: string; scheduleAdviceId: null }
  | { analysisSnapshotId: null; scheduleAdviceId: string };

export interface NarrationRepository {
  createPending(target: NarrationTarget, inputHash: string): Promise<{ narrationId: string }>;
  markReady(narrationId: string, output: VersionedPayload<NarrationOutput>): Promise<void>;
  markFallback(narrationId: string, output: VersionedPayload<NarrationOutput>): Promise<void>;
}
```

- [ ] **Step 4: Implement the provider and strict output schema**

Run: `pnpm add openai`

Add empty `OPENAI_API_KEY` and `OPENAI_MODEL` entries to `.env.example`. The Task 17 environment parser treats either missing value as “provider unavailable” and immediately uses the deterministic template; Task 22 requires both in preview and production.

```ts
export type NarrationFacts = Readonly<{
  target: { kind: "analysis"; id: string } | { kind: "advice"; id: string };
  algorithmVersion: "provisional-v1";
  metrics: readonly { id: string; value: number | null; band: string }[];
  dataBasis: {
    periodStart: string;
    periodEnd: string;
    sampleCount: number;
    excludedCount: number;
    missingFields: readonly string[];
    sourceDistribution: Readonly<Record<"manual", number>>;
  };
  evidence: readonly { code: string; direction: "positive" | "negative" | "neutral"; count: number | null }[];
  event: { type: string; startsAt: string } | null;
  proposal: ScheduleProposal | null;
  confidence: ConfidenceLevel;
}>;

export const narrationOutputSchema = z.object({
  headline: z.string().min(1).max(80),
  body: z.string().min(1).max(600),
  bullets: z.array(z.string().min(1).max(120)).max(3),
}).strict();

export type NarrationOutput = z.infer<typeof narrationOutputSchema>;

export class NarrationProviderError extends Error {
  constructor(readonly code: "UNPARSED_RESPONSE" | "REFUSAL" | "TIMEOUT" | "UNSUPPORTED_CLAIM") {
    super(code);
  }
}

export interface NarrationProvider {
  generate(input: NarrationFacts, signal: AbortSignal): Promise<z.infer<typeof narrationOutputSchema>>;
}
```

```ts
const response = await client.responses.parse({
  model: env.OPENAI_MODEL,
  store: false,
  input: [
    { role: "system", content: "규칙 엔진의 사실만 설명하고 수치·날짜·인과관계를 새로 만들지 마세요." },
    { role: "user", content: JSON.stringify(facts) },
  ],
  text: { format: zodTextFormat(narrationOutputSchema, "sleep_narration") },
}, { signal });

if (!response.output_parsed) throw new NarrationProviderError("UNPARSED_RESPONSE");
return response.output_parsed;
```

Pass the supplied AbortSignal to the OpenAI request options. `withTimeout` creates one AbortController, aborts it after 8 seconds, clears its timer in `finally`, and maps the timeout to `NarrationProviderError("TIMEOUT")`; this prevents a timed-out request from continuing in the background. After schema parsing, `validateNarrationAgainstFacts` collects numeric tokens from the three output fields and allows only tokens already present in the immutable facts; it also rejects the fixed Korean claim denylist `원인이다 | 원인입니다 | 치료 | 진단 | 처방 | 약물`. Any rejection takes the template-fallback path. NarrationFacts permits only metric id/value/band, period/sample/missing/source aggregates, evidence code/direction/count, event type/start, computed proposal, and confidence. It excludes names, event title/notes, raw entries, email, and tokens.

```ts
export async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new NarrationProviderError("TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 5: Implement post-commit status handling**

After commit, call the provider with a bounded timeout. On success set ready; on timeout, missing key, refusal, or schema error save `buildTemplateNarration(facts)` and set template-fallback. A page query finding pending older than 30 seconds atomically stores the same template, changes status to template-fallback, and then renders it. An explicit retry increments retryCount and may set pending again until the count reaches two. Application logs record target ID, provider, model, duration, and status but never prompt or response bodies.

```ts
export type NarrationRequest = Readonly<{
  narrationId: string;
  facts: NarrationFacts;
}>;

export type NarrationDependencies = Readonly<{
  provider: NarrationProvider;
  repository: NarrationRepository;
}>;

export async function generateNarration(request: NarrationRequest, deps: NarrationDependencies): Promise<void> {
  try {
    const output = await withTimeout((signal) => deps.provider.generate(request.facts, signal), 8_000);
    const validation = validateNarrationAgainstFacts(output, request.facts);
    if (!validation.valid) throw new NarrationProviderError("UNSUPPORTED_CLAIM");
    await deps.repository.markReady(request.narrationId, { schemaVersion: 1, ...output });
  } catch {
    const output = buildTemplateNarration(request.facts);
    await deps.repository.markFallback(request.narrationId, { schemaVersion: 1, ...output });
  }
}
```

The three transaction owners dispatch only after commit. RecordService receives pending analysis and reroute requests from its completed Prisma transaction, `createScheduleAdvice` receives the event-advice request, and an explicit retry receives one stored request. Use `Promise.allSettled` so narration cannot change the already successful record/advice response:

```ts
const committed = await prisma.$transaction((tx) => mutateAndQueueNarration(tx, scope, command));
await Promise.allSettled(
  committed.pendingNarration.map((request) => generateNarration(request, narrationDependencies)),
);
return committed.result;
```

- [ ] **Step 6: Migrate and verify narration**

```bash
pnpm prisma migrate dev --name narration
pnpm prisma generate
pnpm test:run tests/unit/template-narration.test.ts tests/unit/narration-validation.test.ts tests/integration/generate-narration.test.ts tests/unit/openai-input-allowlist.test.ts
docker compose -f docker-compose.test.yml up -d postgres
pnpm db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run tests/integration/database-contract.test.ts
docker compose -f docker-compose.test.yml down
pnpm prisma generate
OPENAI_API_KEY= OPENAI_MODEL= pnpm playwright test tests/e2e/narration-fallback.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 7: Commit narration**

```bash
git add package.json pnpm-lock.yaml .env.example prisma src/modules/narration src/modules/analysis/application/recalculate-analysis.ts src/modules/planner/application/create-schedule-advice.ts src/modules/planner/application/evaluate-rerouting.ts src/modules/records/application/record-service.ts tests/unit/template-narration.test.ts tests/unit/narration-validation.test.ts tests/integration/generate-narration.test.ts tests/unit/openai-input-allowlist.test.ts tests/e2e/narration-fallback.spec.ts
git commit -m "feat: add safe sleep narration"
```

### Task 18: Implement Care routines and functional care tools

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/modules/care/domain/routine.ts`
- Create: `src/modules/care/domain/tool-catalog.ts`
- Create: `src/modules/care/application/ports.ts`
- Create: `src/modules/care/application/get-care-view-model.ts`
- Create: `src/modules/care/application/complete-routine-step.ts`
- Create: `src/modules/care/application/undo-routine-step.ts`
- Create: `src/modules/care/application/start-care-tool.ts`
- Create: `src/modules/care/application/complete-care-tool.ts`
- Create: `src/modules/care/infrastructure/prisma-care-repository.ts`
- Create: `src/modules/care/ui/care-hero.tsx`
- Create: `src/modules/care/ui/sync-summary.tsx`
- Create: `src/modules/care/ui/routine-timeline.tsx`
- Create: `src/modules/care/ui/breathing-guide.tsx`
- Create: `src/modules/care/ui/white-noise-player.tsx`
- Create: `src/modules/care/ui/sleep-guide.tsx`
- Create: `src/modules/care/ui/care-tool-grid.tsx`
- Create: `src/modules/care/ui/care.module.css`
- Create: `src/app/(app)/care/page.tsx`
- Create: `src/app/(app)/care/actions.ts`
- Test: `tests/unit/routine-state.test.ts`
- Test: `tests/integration/care-session.test.ts`
- Test: `tests/component/care-screen.test.tsx`
- Test: `tests/e2e/care.spec.ts`

**Interfaces:**
- Consumes: active PlanDay, UserScope, Clock, MutationReceipt
- Produces: derived RoutineStatus, RoutineCompletion, CareToolSession, three bounded tools

- [ ] **Step 1: Write failing routine-state and session tests**

```ts
it("derives done, current, and upcoming without persisted display state", () => {
  expect(deriveRoutineTimeline(
    routineFixture,
    new Set(["meal-cutoff"]),
    new Date("2026-08-19T13:30:00.000Z"),
  )).toEqual([
    expect.objectContaining({ stepKey: "meal-cutoff", status: "done" }),
    expect.objectContaining({ stepKey: "phone-wind-down", status: "current" }),
    expect.objectContaining({ stepKey: "target-bed", status: "upcoming" }),
  ]);
});

it("allows undo only before the local day closes", async () => {
  await expect(service.undo({ localDate: "2026-08-18", stepKey: "phone-wind-down" })).rejects.toThrow("ROUTINE_DAY_CLOSED");
});
```

- [ ] **Step 2: Run tests and verify missing Care behavior**

Run: `pnpm test:run tests/unit/routine-state.test.ts tests/integration/care-session.test.ts tests/component/care-screen.test.tsx`

Expected: FAIL because Care models and components do not exist.

- [ ] **Step 3: Add Care persistence and state derivation**

Add `RoutineCompletion(userId, localDate, stepKey, completedAt)` unique on `[userId, localDate, stepKey]` and `CareToolSession(userId, localDate, toolKey, startedAt, plannedDurationSeconds, completedAt)`. Build routine definitions from the active PlanDay, or from SleepGoal cutoffs when no accepted plan exists. Routine status is calculated: completion row → done, first due incomplete step → current, remaining → upcoming. Same-day undo deletes completion; a closed local day or superseded PlanDay is immutable.

```ts
export type RoutineDefinition = Readonly<{
  key: "caffeine-cutoff" | "exercise-cutoff" | "meal-cutoff" | "phone-wind-down" | "target-bed";
  label: string;
  scheduledAt: Date;
}>;

export type RoutineStepViewModel = RoutineDefinition & Readonly<{
  status: "done" | "current" | "upcoming";
}>;

export type CareViewModel = Readonly<{
  localDate: string;
  planDay: PlanDayTarget | null;
  inputState: "needs-input" | "complete";
  routineSteps: readonly RoutineStepViewModel[];
}>;

export interface CareRepository {
  listCompletions(localDate: string): Promise<ReadonlySet<string>>;
  completeStep(localDate: string, stepKey: RoutineDefinition["key"], completedAt: Date): Promise<void>;
  undoStep(localDate: string, stepKey: RoutineDefinition["key"]): Promise<void>;
  startTool(input: { localDate: string; toolKey: CareToolKey; plannedDurationSeconds: number; startedAt: Date }): Promise<{ sessionId: string }>;
  completeTool(sessionId: string, completedAt: Date): Promise<void>;
}

export function deriveRoutineTimeline(
  steps: readonly RoutineDefinition[],
  completedKeys: ReadonlySet<string>,
  now: Date,
): readonly RoutineStepViewModel[] {
  const currentKey = steps.find((step) => !completedKeys.has(step.key) && step.scheduledAt <= now)?.key ?? null;
  return steps.map((step) => ({
    ...step,
    status: completedKeys.has(step.key) ? "done" : step.key === currentKey ? "current" : "upcoming",
  }));
}
```

- [ ] **Step 4: Implement exactly three bounded tools**

```ts
export const CARE_TOOL_CATALOG = [
  { key: "breathing", label: "호흡 가이드", defaultSeconds: 180 },
  { key: "white-noise", label: "백색소음", defaultSeconds: 900 },
  { key: "sleep-guide", label: "ASMR·수면 가이드", defaultSeconds: 300 },
] as const;

export type CareToolKey = (typeof CARE_TOOL_CATALOG)[number]["key"];

export const BREATHING_PHASES = [
  { key: "inhale", label: "들이마시기", seconds: 4 },
  { key: "hold", label: "멈추기", seconds: 2 },
  { key: "exhale", label: "내쉬기", seconds: 6 },
] as const;

export const SLEEP_GUIDE_STEPS = [
  { startsAtSeconds: 0, label: "편안한 자세를 잡고 눈을 감아보세요." },
  { startsAtSeconds: 60, label: "턱과 이마의 힘을 천천히 풀어주세요." },
  { startsAtSeconds: 120, label: "어깨와 손끝의 긴장을 내려놓으세요." },
  { startsAtSeconds: 180, label: "오늘의 생각은 잠시 옆에 두어도 괜찮아요." },
  { startsAtSeconds: 240, label: "호흡을 세지 말고 자연스럽게 쉬어보세요." },
] as const;
```

Breathing repeats the fixed 4-second inhale, 2-second hold, and 6-second exhale cycle for 180 active seconds. Pause freezes both phase and elapsed time; resume continues them; stop is idempotent and does not mark completion. White noise starts only after a pointer/keyboard gesture, uses a looping browser Web Audio noise buffer through a GainNode capped at `0.08`, defaults to and never exceeds 900 seconds, and disconnects every node on stop, timeout, route change, or unmount. Sleep guide advances through the five fixed one-minute Korean steps above and ends at 300 active seconds; pause/resume semantics match breathing. Start writes one CareToolSession, natural completion sets `completedAt` once, and repeated completion is idempotent. Unit/integration tests use a fake clock and fake audio context to assert exact phase boundaries, duration caps, cleanup, and one completion write. Do not add content discovery, streaming, medical claims, or recommendation feeds.

- [ ] **Step 5: Render Figma Care and direct-input status**

Care renders hero, “직접 입력 사용 중” SyncSummary, RoutineTimeline, and CareToolGrid on desktop and mobile. Automatic `unavailable | syncing | complete | error` component variants remain testable but inactive and never show fabricated lastSyncedAt.

```tsx
<main>
  <CareHero planDay={viewModel.planDay} />
  <SyncSummary mode="manual" availability="available" state={viewModel.inputState} />
  <RoutineTimeline steps={viewModel.routineSteps} />
  <CareToolGrid tools={CARE_TOOL_CATALOG} />
</main>
```

- [ ] **Step 6: Migrate and verify Care**

```bash
pnpm prisma migrate dev --name care
pnpm prisma generate
pnpm test:run tests/unit/routine-state.test.ts tests/integration/care-session.test.ts tests/component/care-screen.test.tsx
docker compose -f docker-compose.test.yml up -d postgres
pnpm db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run tests/integration/database-contract.test.ts
docker compose -f docker-compose.test.yml down
pnpm prisma generate
pnpm playwright test tests/e2e/care.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 7: Commit Care**

```bash
git add prisma src/modules/care src/app/\(app\)/care tests/unit/routine-state.test.ts tests/integration/care-session.test.ts tests/component/care-screen.test.tsx tests/e2e/care.spec.ts
git commit -m "feat: add nightly care experience"
```

### Task 19: Build Account settings and connection management

**Files:**
- Create: `src/modules/account/domain/schemas.ts`
- Create: `src/modules/account/application/ports.ts`
- Create: `src/modules/account/application/get-account-view-model.ts`
- Create: `src/modules/account/application/update-profile.ts`
- Create: `src/modules/account/application/update-sleep-goal.ts`
- Create: `src/modules/account/infrastructure/prisma-account-repository.ts`
- Create: `src/modules/account/ui/profile-form.tsx`
- Create: `src/modules/account/ui/sleep-goal-card.tsx`
- Create: `src/modules/account/ui/connection-list.tsx`
- Create: `src/modules/account/ui/manual-input-rules.tsx`
- Create: `src/modules/account/ui/data-management-entry.tsx`
- Create: `src/modules/account/ui/account-screen.tsx`
- Create: `src/modules/account/ui/account.module.css`
- Create: `src/shared/ui/bottom-sheet.tsx`
- Create: `src/app/(app)/account/page.tsx`
- Create: `src/app/(app)/account/actions.ts`
- Test: `tests/integration/account-settings.test.ts`
- Test: `tests/component/account-screen.test.tsx`
- Test: `tests/e2e/account-settings.spec.ts`

**Interfaces:**
- Consumes: UserProfile, SleepGoal, UserHabit, Connection, `UserScope`
- Produces: `AccountViewModel`, scoped profile/goal updates, truthful connection summaries

- [ ] **Step 1: Write failing ownership and copy tests**

```tsx
render(<ConnectionList connections={connectionFixture} />);
expect(screen.getByText("휴대폰 연동 준비 중")).toBeVisible();
expect(screen.getByText("직접 입력 사용 중")).toBeVisible();
expect(screen.queryByText("자동 입력 중")).not.toBeInTheDocument();
```

The integration test updates Alice's goal using Alice's scope, attempts Bob's profile ID through the same service, and verifies Bob remains unchanged.

- [ ] **Step 2: Run tests and verify missing Account behavior**

Run: `pnpm test:run tests/integration/account-settings.test.ts tests/component/account-screen.test.tsx`

Expected: FAIL because Account service and UI do not exist.

- [ ] **Step 3: Implement scoped settings mutations**

```ts
export type AccountData = Readonly<{
  identity: { email: string };
  profile: { nickname: string; timezone: string };
  sleepGoal: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number };
  connections: readonly ({ type: "manual" | "wearable" | "phone" | "calendar"; label: string } & ConnectionStatus)[];
  manualInputCategories: readonly RecordType[];
}>;

export type AccountViewModel = AccountData & Readonly<{
  dataManagement: { exportRequiresReauth: boolean; deleteRequiresReauth: boolean };
}>;

export interface AccountRepository {
  getViewModelData(scope: UserScope): Promise<AccountData>;
  updateProfile(scope: UserScope, input: { nickname: string; timezone: string }): Promise<void>;
  updateSleepGoal(scope: UserScope, input: { targetBedTime: string; targetWakeTime: string; targetDurationMinutes: number }): Promise<void>;
}
```

Account shows the Better Auth email read-only; this release has no email-change flow. Changing timezone affects new records and plans only. Existing DailyLog, SleepSession sleepDate, PlanDay localDate, and historical snapshots remain unchanged. The timezone update transaction supersedes the prior timezone's active plan/future days and all unaccepted advice, then creates a fresh insufficient analysis namespace for the new timezone; the UI falls back to the goal until new direct records exist. Goal changes trigger a fresh current analysis and mark unaccepted goal-dependent advice superseded.

The sleep-goal Server Action accepts only `targetBedTime` and `targetWakeTime`; `updateSleepGoal` reuses Task 5 validation and derives `targetDurationMinutes` server-side before calling the repository. A client-supplied duration field is ignored/rejected, so the three stored values cannot disagree.

The query reads the one persisted manual Connection and merges it with a static catalog for wearable, phone, and calendar. Those three entries are always `automatic + coming-soon + unavailable + lastSyncedAt:null` in this release; no timestamp or connected label is inferred from records. `ConnectionList` maps them to “웨어러블 연동 준비 중”, “휴대폰 연동 준비 중”, and “캘린더 연동 준비 중”.

- [ ] **Step 4: Implement desktop tabs and mobile detail sheets**

Desktop Account shows personal info, sleep goal, connection management, manual-input rules for sleep/phone/caffeine/alcohol/meal/exercise/wellness, and Data Management entry. Mobile shows profile/goal/connection summaries first and opens detail editing in bottom sheets or collapsible sections.

```tsx
export function AccountScreen({ viewModel }: { viewModel: AccountViewModel }) {
  return (
    <main className={styles.accountLayout}>
      <nav aria-label="계정 설정" className={styles.desktopTabs}>
        <a href="#profile">개인 정보</a>
        <a href="#goal">수면 목표</a>
        <a href="#connections">연결 관리</a>
        <a href="#data">데이터 관리</a>
      </nav>
      <section id="profile"><ProfileForm identity={viewModel.identity} profile={viewModel.profile} /></section>
      <section id="goal"><SleepGoalCard goal={viewModel.sleepGoal} /></section>
      <section id="connections">
        <ConnectionList connections={viewModel.connections} />
        <ManualInputRules categories={viewModel.manualInputCategories} />
      </section>
      <section id="data"><DataManagementEntry reauth={viewModel.dataManagement} /></section>
      <div className={styles.mobileDetails}>
        <BottomSheet triggerLabel="개인 정보 수정"><ProfileForm identity={viewModel.identity} profile={viewModel.profile} /></BottomSheet>
        <BottomSheet triggerLabel="수면 목표 수정"><SleepGoalCard goal={viewModel.sleepGoal} /></BottomSheet>
        <BottomSheet triggerLabel="연결·직접 입력 보기"><ConnectionList connections={viewModel.connections} /></BottomSheet>
      </div>
    </main>
  );
}
```

`BottomSheet` uses a native dialog contract: its trigger carries `aria-haspopup="dialog"`, opening moves focus to the heading, Tab remains trapped inside, Escape closes, and closing restores focus to the trigger. Desktop CSS hides `.mobileDetails`; mobile CSS hides `.desktopTabs` but never hides `#data`.

- [ ] **Step 5: Verify Account settings**

```bash
pnpm test:run tests/integration/account-settings.test.ts tests/component/account-screen.test.tsx
pnpm playwright test tests/e2e/account-settings.spec.ts --project=chromium
pnpm typecheck
```

- [ ] **Step 6: Commit Account settings**

```bash
git add src/modules/account src/shared/ui/bottom-sheet.tsx src/app/\(app\)/account tests/integration/account-settings.test.ts tests/component/account-screen.test.tsx tests/e2e/account-settings.spec.ts
git commit -m "feat: add account and sleep settings"
```

### Task 20: Add private export and atomic account deletion

**Files:**
- Create: `src/modules/account/domain/export-schema.ts`
- Create: `src/modules/account/application/require-recent-authentication.ts`
- Create: `src/modules/account/application/export-user-data.ts`
- Create: `src/modules/account/application/delete-user-account.ts`
- Create: `src/modules/account/infrastructure/prisma-account-data-repository.ts`
- Create: `src/modules/account/ui/data-management.tsx`
- Create: `src/app/api/account/export/route.ts`
- Modify: `src/app/(app)/account/actions.ts`
- Modify: `src/app/(app)/account/page.tsx`
- Modify: `src/modules/account/ui/data-management-entry.tsx`
- Modify: `src/shared/auth/auth-origin.ts`
- Test: `tests/integration/account-export-delete.test.ts`
- Test: `tests/e2e/account-data-management.spec.ts`

**Interfaces:**
- Consumes: Better Auth password verification, five-minute fresh-session policy, all scoped repositories
- Produces: versioned JSON export, all-or-nothing hard delete, immediate sign-out

- [ ] **Step 1: Write failing export exclusion and rollback tests**

```ts
it("exports domain data without authentication secrets", async () => {
  const output = await service.export(exportCommand);
  const text = new TextDecoder().decode(output.body);
  const exported = JSON.parse(text) as Record<string, unknown>;
  expect(text).toContain("\"schemaVersion\":1");
  expect(Object.keys(exported)).not.toEqual(expect.arrayContaining(["user", "accounts", "sessions", "verifications", "rateLimits"]));
  expect(collectObjectKeys(exported)).not.toEqual(expect.arrayContaining([
    "password", "accessToken", "refreshToken", "idToken", "sessionToken", "verificationToken", "secret",
  ]));
});
```

The deletion test injects a failure before User deletion and asserts every domain and auth row still exists; the success case asserts all rows for the current user are gone while another user is untouched.

- [ ] **Step 2: Run tests and verify missing data-management behavior**

Run: `pnpm test:run tests/integration/account-export-delete.test.ts`

Expected: FAIL because export and deletion services do not exist.

- [ ] **Step 3: Implement fresh reauthentication and exact export scope**

Force a database-backed session lookup with `disableCookieCache: true`. If `clock.now() - session.createdAt` exceeds five minutes, require a non-empty password and verify it with Better Auth's server-only `auth.api.verifyPassword`; a missing or invalid password returns the same generic `REAUTHENTICATION_REQUIRED` result. Never sign in again merely to verify a password, because that would create an unintended extra session.

```ts
export class ReauthenticationError extends Error {
  readonly code = "REAUTHENTICATION_REQUIRED";
}

export class InvalidMutationOriginError extends Error {
  readonly code = "INVALID_MUTATION_ORIGIN";
}

export class AccountDeletionConfirmationError extends Error {
  readonly code = "ACCOUNT_DELETION_CONFIRMATION_MISMATCH";
}

export class AccountDeletionRaceError extends Error {
  readonly code = "ACCOUNT_DELETION_RACE";
}

export type SensitiveActionSession = Readonly<{
  userId: string;
  email: string;
  createdAt: Date;
}>;

export async function requireRecentAuthentication(
  session: SensitiveActionSession,
  password: string | null,
  requestHeaders: Headers,
  clock: Clock,
): Promise<void> {
  if (clock.now().getTime() - session.createdAt.getTime() <= 5 * 60_000) return;
  if (!password) throw new ReauthenticationError();
  try {
    await auth.api.verifyPassword({ body: { password }, headers: requestHeaders });
  } catch {
    throw new ReauthenticationError();
  }
}
```

`POST /api/account/export` accepts JSON `{ password: string | null }`, rejects an Origin outside `resolveAuthOrigin(...).trustedOrigins`, verifies the session and freshness, and returns the versioned export bytes. Export account email/createdAt as non-secret identity metadata, profile, goal, habits, connection settings, direct records and revisions, events/plans/advice/revisions, analysis/DataBasis metadata, validated Narration output, routine completions, and care sessions. Exclude User password material, Account credentials, Verification values, Session tokens, RateLimit rows, environment secrets, and LLM prompt text.

```ts
export const exportRequestSchema = z.object({
  password: z.string().min(8).max(128).nullable(),
});

export type UserDataExport = VersionedPayload<{
  exportedAt: string;
  identity: { email: string; createdAt: string };
  profile: AccountData["profile"];
  sleepGoal: AccountData["sleepGoal"];
  habits: readonly { category: string; value: string }[];
  connections: AccountData["connections"];
  records: readonly SerializedRecord[];
  recordRevisions: readonly {
    entityType: RecordType;
    entityId: string;
    operation: "create" | "update" | "delete";
    before: VersionedPayload<{ record: SerializedRecord }> | null;
    after: VersionedPayload<{ record: SerializedRecord }> | null;
    changedAt: string;
  }[];
  planner: {
    events: readonly { id: string; type: string; startsAt: string; desiredWakeAt: string | null }[];
    plans: readonly SleepPlanEntity[];
    advice: readonly ScheduleAdviceEntity[];
    revisions: readonly { id: string; planId: string; before: VersionedPayload<{ days: readonly PlanDayTarget[] }>; after: VersionedPayload<{ days: readonly PlanDayTarget[] }>; createdAt: string }[];
  };
  analyses: readonly { localDate: string; result: AnalysisResult }[];
  narrations: readonly { targetId: string; status: "ready" | "template-fallback"; output: VersionedPayload<NarrationOutput> }[];
  care: {
    routineCompletions: readonly { localDate: string; stepKey: string; completedAt: string }[];
    toolSessions: readonly { localDate: string; toolKey: CareToolKey; startedAt: string; plannedDurationSeconds: number; completedAt: string | null }[];
  };
}>;

export interface AccountDataExportRepository {
  load(scope: UserScope): Promise<Omit<UserDataExport, "schemaVersion" | "exportedAt">>;
}

export type ExportUserData = (scope: UserScope) => Promise<UserDataExport>;

export function createExportUserData(repository: AccountDataExportRepository, clock: Clock): ExportUserData {
  return async function exportUserData(scope) {
    const output: UserDataExport = {
      schemaVersion: 1,
      exportedAt: clock.now().toISOString(),
      ...(await repository.load(scope)),
    };
    return output;
  };
}

export function assertTrustedMutationOrigin(origin: string | null): void {
  const trusted = resolveAuthOrigin(process.env).trustedOrigins;
  try {
    if (!origin || !trusted.includes(new URL(origin).origin)) throw new InvalidMutationOriginError();
  } catch {
    throw new InvalidMutationOriginError();
  }
}
```

`PrismaAccountDataRepository.load` selects every table with an explicit same-user predicate, converts dates to ISO strings, and parses every JSON column with the owning domain schema (`recordRevisionEnvelopeSchema`, `analysisResultSchema`, planner schemas, and `narrationOutputSchema`) before returning. A malformed stored payload fails the export with `CORRUPT_STORED_PAYLOAD`; raw JSON strings and unknown keys are never copied into the download.

```ts
export async function POST(request: Request): Promise<Response> {
  assertTrustedMutationOrigin(request.headers.get("origin"));
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const input = exportRequestSchema.parse(await request.json());
  await requireRecentAuthentication(
    { userId: session.user.id, email: session.user.email, createdAt: session.session.createdAt },
    input.password,
    request.headers,
    systemClock,
  );
  const exported = await exportUserData(await requireUserScope());
  return new Response(JSON.stringify(exported), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sleep-planner-${exported.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 4: Implement one hard-delete transaction**

```ts
export type DeleteAccountCommand = Readonly<{
  password: string | null;
  confirmationEmail: string;
  confirmationPhrase: "계정 삭제";
}>;

export type DeleteAccountContext = Readonly<{
  scope: UserScope;
  session: SensitiveActionSession & { sessionId: string };
  requestHeaders: Headers;
}>;
```

Validate the current email and phrase, run the same five-minute reauthentication rule, then delete in this order within one Prisma transaction: other sessions; Narration, ImpactFactor, AnalysisSnapshot, and BaselineSnapshot; PlanRevision, PlanDay, ScheduleAdvice, SleepPlan, and SpecialEvent; RoutineCompletion and CareToolSession; RecordRevision and all direct records; MutationReceipt and DailyLog; Connection, UserHabit, SleepGoal, and UserProfile; Account by userId and Verification rows whose exact identifier equals the current user ID or email; current Session; User. Any error rolls back. Require the final User delete count to equal one.

```ts
export async function deleteUserAccount(
  command: DeleteAccountCommand,
  context: DeleteAccountContext,
  deps: { prisma: PrismaClient; clock: Clock },
): Promise<void> {
  await requireRecentAuthentication(context.session, command.password, context.requestHeaders, deps.clock);
  const { scope } = context;
  const currentSessionId = context.session.sessionId;

  await deps.prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: scope.userId },
    select: { id: true, email: true },
  });
  if (user.email !== command.confirmationEmail || command.confirmationPhrase !== "계정 삭제") {
    throw new AccountDeletionConfirmationError();
  }

  await tx.session.deleteMany({ where: { userId: scope.userId, NOT: { id: currentSessionId } } });
  await tx.narration.deleteMany({ where: { userId: scope.userId } });
  await tx.impactFactor.deleteMany({ where: { userId: scope.userId } });
  await tx.analysisSnapshot.deleteMany({ where: { userId: scope.userId } });
  await tx.baselineSnapshot.deleteMany({ where: { userId: scope.userId } });
  await tx.planRevision.deleteMany({ where: { userId: scope.userId } });
  await tx.planDay.deleteMany({ where: { userId: scope.userId } });
  await tx.scheduleAdvice.deleteMany({ where: { userId: scope.userId } });
  await tx.sleepPlan.deleteMany({ where: { userId: scope.userId } });
  await tx.specialEvent.deleteMany({ where: { userId: scope.userId } });
  await tx.routineCompletion.deleteMany({ where: { userId: scope.userId } });
  await tx.careToolSession.deleteMany({ where: { userId: scope.userId } });
  await deleteAllRecordRows(tx, scope);
  await tx.mutationReceipt.deleteMany({ where: { userId: scope.userId } });
  await tx.dailyLog.deleteMany({ where: { userId: scope.userId } });
  await tx.connection.deleteMany({ where: { userId: scope.userId } });
  await tx.userHabit.deleteMany({ where: { userId: scope.userId } });
  await tx.sleepGoal.deleteMany({ where: { userId: scope.userId } });
  await tx.userProfile.deleteMany({ where: { userId: scope.userId } });
  await tx.account.deleteMany({ where: { userId: scope.userId } });
  await tx.verification.deleteMany({
    where: { identifier: { in: [user.id, user.email] } },
  });
  await tx.session.deleteMany({ where: { id: currentSessionId, userId: scope.userId } });
  const deleted = await tx.user.deleteMany({ where: { id: scope.userId, email: user.email } });
  if (deleted.count !== 1) throw new AccountDeletionRaceError();
  });
}
```

The Server Action first calls `assertTrustedMutationOrigin((await headers()).get("origin"))`, then calls the transaction, expires the fixed `AUTH_SESSION_COOKIE` with `(await cookies()).delete(AUTH_SESSION_COOKIE)`, and redirects to `/sign-in?deleted=1`. Better Auth's generic delete-user endpoint stays disabled, so there is no route that skips this transaction or its confirmation checks. `deleteAllRecordRows(tx, scope): Promise<void>` enumerates RecordRevision, SleepSession, PhoneUsageEntry, CaffeineEntry, AlcoholEntry, MealEntry, ExerciseEntry, and WellnessEntry in child-before-parent order; it is not a raw cascading shortcut.

- [ ] **Step 5: Verify sensitive flows**

```bash
pnpm test:run tests/integration/account-export-delete.test.ts
pnpm playwright test tests/e2e/account-data-management.spec.ts --project=chromium
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit sensitive data management**

```bash
git add src/modules/account src/shared/auth/auth-origin.ts src/app/api/account src/app/\(app\)/account tests/integration/account-export-delete.test.ts tests/e2e/account-data-management.spec.ts
git commit -m "feat: add private data management"
```

### Task 21: Complete responsive Figma fidelity and accessibility gates

**Files:**
- Create: `tests/visual/manifest.ts`
- Create: `tests/visual/fixtures.ts`
- Create: `tests/visual/authenticate.ts`
- Create: `tests/visual/runtime-frames.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `scripts/seed-visual-fixtures.ts`
- Create: `src/shared/ui/fonts.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `playwright.config.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/shared/ui/app-shell/app-shell.module.css`
- Modify: `src/app/(auth)/auth.module.css`
- Modify: `src/modules/onboarding/ui/onboarding.module.css`
- Modify: `src/modules/records/ui/records.module.css`
- Modify: `src/modules/analysis/ui/today.module.css`
- Modify: `src/modules/planner/ui/plan.module.css`
- Modify: `src/modules/analysis/ui/analyze.module.css`
- Modify: `src/modules/care/ui/care.module.css`
- Modify: `src/modules/account/ui/account.module.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: every runtime route and seeded ViewModel from Tasks 1–20
- Produces: deterministic frame manifest, desktop/mobile visual snapshots, keyboard/contrast/reduced-motion checks

- [ ] **Step 1: Write the explicit runtime-frame manifest**

```ts
export const VISUAL_FRAMES = [
  { name: "sign-in-desktop", path: "/sign-in", viewport: { width: 1440, height: 1024 }, fixture: "signed-out" },
  { name: "onboarding-connect-mobile", path: "/onboarding/connect", viewport: { width: 390, height: 844 }, fixture: "new-user" },
  { name: "onboarding-goal-mobile", path: "/onboarding/sleep-goal", viewport: { width: 390, height: 844 }, fixture: "onboarding-connect" },
  { name: "onboarding-habits-mobile", path: "/onboarding/habits", viewport: { width: 390, height: 844 }, fixture: "onboarding-goal" },
  { name: "onboarding-profile-mobile", path: "/onboarding/profile", viewport: { width: 390, height: 844 }, fixture: "onboarding-habits" },
  { name: "today-desktop", path: "/today", viewport: { width: 1440, height: 1024 }, fixture: "complete-user" },
  { name: "today-mobile", path: "/today", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "record-desktop", path: "/record", viewport: { width: 1440, height: 1024 }, fixture: "complete-user" },
  { name: "record-mobile", path: "/record", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "caffeine-brand-mobile", path: "/record/caffeine?step=brand", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "caffeine-menu-amount-mobile", path: "/record/caffeine?step=menu-and-amount", viewport: { width: 390, height: 844 }, fixture: "caffeine-brand" },
  { name: "caffeine-confirm-mobile", path: "/record/caffeine?step=confirm", viewport: { width: 390, height: 844 }, fixture: "caffeine-draft" },
  { name: "alcohol-type-mobile", path: "/record/alcohol?step=type", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "alcohol-amount-mobile", path: "/record/alcohol?step=amount", viewport: { width: 390, height: 844 }, fixture: "alcohol-type" },
  { name: "alcohol-confirm-mobile", path: "/record/alcohol?step=confirm", viewport: { width: 390, height: 844 }, fixture: "alcohol-draft" },
  { name: "meal-health-meal-mobile", path: "/record/meal-health?step=meal", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "meal-health-wellness-mobile", path: "/record/meal-health?step=exercise-and-wellness", viewport: { width: 390, height: 844 }, fixture: "meal-health-meal" },
  { name: "meal-health-confirm-mobile", path: "/record/meal-health?step=confirm", viewport: { width: 390, height: 844 }, fixture: "meal-health-draft" },
  { name: "sleep-phone-sleep-mobile", path: "/record/sleep-phone?step=sleep", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "sleep-phone-phone-mobile", path: "/record/sleep-phone?step=phone", viewport: { width: 390, height: 844 }, fixture: "sleep-phone-sleep" },
  { name: "sleep-phone-confirm-mobile", path: "/record/sleep-phone?step=confirm", viewport: { width: 390, height: 844 }, fixture: "sleep-phone-draft" },
  { name: "plan-desktop", path: "/plan", viewport: { width: 1440, height: 1024 }, fixture: "planned-user" },
  { name: "plan-mobile", path: "/plan", viewport: { width: 390, height: 844 }, fixture: "planned-user" },
  { name: "analyze-desktop", path: "/analyze", viewport: { width: 1440, height: 1024 }, fixture: "complete-user" },
  { name: "analyze-mobile", path: "/analyze", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
  { name: "care-desktop", path: "/care", viewport: { width: 1440, height: 1024 }, fixture: "planned-user" },
  { name: "care-mobile", path: "/care", viewport: { width: 390, height: 844 }, fixture: "planned-user" },
  { name: "account-desktop", path: "/account", viewport: { width: 1440, height: 1024 }, fixture: "complete-user" },
  { name: "account-mobile", path: "/account", viewport: { width: 390, height: 844 }, fixture: "complete-user" },
] as const;
```

Foundations, Components, Cover, and Product Flow are references, not runtime screenshots.

- [ ] **Step 2: Write deterministic visual and accessibility tests**

Run: `pnpm add -D @axe-core/playwright`

For each frame: create an isolated Better Auth user when the fixture is not `signed-out`, seed only that user's domain rows, set Playwright clock to `2026-08-19T12:00:00.000Z`, set timezone `Asia/Seoul`, wait for `document.fonts.ready`, disable animation/transition/caret, mock OpenAI and abort unapproved external network, then capture the page at the manifest viewport. The public Figma Foundations frame exposes the `Display/Care`, `Heading/Page`, and `Body/Medium` hierarchy but not a family label, so lock the implementation decision instead of relying on OS fonts: install `pretendard@1.3.9`, import its packaged variable-font CSS from `src/app/layout.tsx`, and set the global family to `"Pretendard Variable", Pretendard, sans-serif`. No font CDN is allowed in tests or production.

```ts
export const APP_TYPOGRAPHY = Object.freeze({
  family: '"Pretendard Variable", Pretendard, sans-serif',
  displayCare: { fontSize: 32, lineHeight: 40, fontWeight: 700 },
  headingPage: { fontSize: 28, lineHeight: 36, fontWeight: 700 },
  bodyMedium: { fontSize: 14, lineHeight: 21, fontWeight: 500 },
});
```

Mirror these values as `--font-*` tokens. If visual calibration shows a size/line-height mismatch, update `APP_TYPOGRAPHY`, the tokens, and their component test together; do not introduce page-local font declarations.

```ts
test.use({ timezoneId: "Asia/Seoul", colorScheme: "light" });

for (const frame of VISUAL_FRAMES) {
  test(frame.name, async ({ page }, testInfo) => {
    if (frame.fixture === "signed-out") {
      await page.context().clearCookies();
    } else {
      const identity = visualIdentity(testInfo.workerIndex, frame.name);
      const response = await page.request.post("/api/auth/sign-up/email", {
        data: { name: "Visual User", email: identity.email, password: identity.password },
      });
      expect(response.ok()).toBe(true);
      await seedVisualFixture(frame.fixture, identity.email);
    }
    await page.clock.install({ time: new Date("2026-08-19T12:00:00.000Z") });
    await page.setViewportSize(frame.viewport);
    await mockNarrationProvider(page);
    await blockUnexpectedExternalRequests(page);
    await page.goto(frame.path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${frame.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
```

`visualIdentity` uses one random run prefix plus worker index and a sanitized frame name under the reserved `.invalid` TLD; password is a fixed test-only value that meets the policy. `seedVisualFixture` refuses to run unless `NODE_ENV === "test"` or `VISUAL_TEST === "1"`, resolves the user by exact email, and replaces only that user's domain rows in one transaction. It never deletes User, Account, or Session rows, so the session cookie produced by the sign-up request remains valid. Each test owns a unique user, making parallel visual runs deterministic on SQLite and PostgreSQL.

```ts
const VISUAL_RUN_ID = crypto.randomUUID();

export function visualIdentity(workerIndex: number, frameName: string) {
  const safeFrame = frameName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return {
    email: `visual+${VISUAL_RUN_ID}-${workerIndex}-${safeFrame}@example.invalid`,
    password: "Visual-test-only-2026!",
  } as const;
}
```

The accessibility spec runs AxeBuilder on `/sign-in`, every onboarding step, and the six app routes, failing on serious or critical violations. Separate keyboard cases traverse each page without a pointer, assert `:focus-visible`, open/close every dialog with Enter/Escape, verify focus trap/return, and rerun timer/chart/tool interactions with `reducedMotion: "reduce"`.

```ts
const result = await new AxeBuilder({ page }).analyze();
expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
```

- [ ] **Step 3: Run visual tests to capture intentional failures**

Run: `pnpm test:visual`

Expected: FAIL with new or mismatched screenshots before Figma calibration.

- [ ] **Step 4: Calibrate every route against its Figma frame**

Adjust only semantic tokens, CSS Modules, layout composition, typography, icon sizes, spacing, radius, and responsive presentation. Preserve domain/ViewModel/action contracts. Mobile Plan retains add/apply CTA; Mobile Analyze retains access to all metrics; Mobile Account retains data-management access; mobile bottom navigation remains Today/Record/Plan/Analyze/Care.

Build an icon audit table in the reviewed snapshot PR: each visible Figma glyph maps either to the same named Lucide glyph already used by the app or to an exact committed Figma SVG asset. Do not redraw icons with CSS, substitute emojis, or accept a visually similar glyph without recording the mapping. The SLEEP LOOP wordmark remains text because the Figma source is text, not an image asset.

Use `1440×1024` and `390×844` as the two locked calibration canvases. At each mismatch, compare in this order: font load/weight → shell width → content max-width → section gap → card padding/radius → control/icon size → local alignment. Update shared values in `tokens.css`; route-specific structure belongs only in that route's CSS Module. Use a single mobile breakpoint and safe-area padding without branching the data contract:

```css
@media (max-width: 767px) {
  .desktopOnly { display: none; }
  .page { padding: var(--space-2); padding-bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom)); }
}

@media (min-width: 768px) {
  .mobileOnly { display: none; }
  .page { max-width: var(--content-max); margin-inline: auto; padding: var(--space-4); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 5: Run complete visual and accessibility verification**

```bash
pnpm test:visual
pnpm playwright test tests/e2e/accessibility.spec.ts --project=chromium
pnpm test:run
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all checks PASS with reviewed baseline snapshots and no serious axe violations.

- [ ] **Step 6: Commit responsive fidelity**

```bash
git add src tests/visual tests/e2e/accessibility.spec.ts scripts/seed-visual-fixtures.ts playwright.config.ts package.json pnpm-lock.yaml
git commit -m "feat: match responsive figma screens"
```

### Task 22: Prove PostgreSQL parity and deploy to Vercel

**Files:**
- Modify: `scripts/prepare-prisma-schema.mjs`
- Create: `scripts/verify-migrations.ts`
- Create: `scripts/verify-auth-schema.ts`
- Create: `scripts/deploy-preview.mjs`
- Modify: `docker-compose.test.yml`
- Create: `.github/workflows/ci.yml`
- Create: `vercel.json`
- Modify: `next.config.ts`
- Modify: `tests/integration/database-contract.test.ts`
- Create: `tests/e2e/production-smoke.spec.ts`
- Modify: `prisma/schema.prisma`
- Move: `prisma/migrations/` to `prisma/migrations-sqlite/`
- Create: `prisma/migrations/20260819000000_initial_postgresql/migration.sql`
- Create: `prisma/migrations/migration_lock.toml`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Consumes: complete SQLite application and repository suite
- Produces: provider-parity test jobs, PostgreSQL migration history, preview/production deployment gates

- [ ] **Step 1: Extend the provider-neutral contract test to every model**

```ts
it("preserves ownership, JSON, unique keys, cascade, ordering, and rollback", async () => {
  const result = await runDatabaseContract(databaseFixture);
  expect(result).toEqual({
    isolatedUsers: true,
    versionedJsonRoundTrip: true,
    dailyLogCompositeUnique: true,
    activeKeyInvariant: true,
    currentKeyInvariant: true,
    userCascade: true,
    transactionRolledBack: true,
    orderedLocalDates: ["2026-08-18", "2026-08-19"],
  });
});
```

- [ ] **Step 2: Run the contract against SQLite first**

Run: `DATABASE_URL=file:./prisma/contract.db pnpm test:run tests/integration/database-contract.test.ts`

Expected: PASS on the verified local provider.

- [ ] **Step 3: Generate a PostgreSQL test schema from the canonical model**

`prepare-prisma-schema.mjs` reads `prisma/schema.prisma`, replaces only the datasource provider value with the requested `sqlite` or `postgresql`, writes gitignored `prisma/schema.active.prisma`, and fails if zero or more than one provider line changes. CI jobs are isolated, generate `src/generated/prisma` from the active schema, and use `prisma db push` only for disposable contract databases.

```js
import { readFile, writeFile } from "node:fs/promises";

const optionIndex = process.argv.indexOf("--provider");
const provider = process.argv[optionIndex + 1];
if (!new Set(["sqlite", "postgresql"]).has(provider)) {
  throw new Error("--provider must be sqlite or postgresql");
}

const source = await readFile("prisma/schema.prisma", "utf8");
const blocks = [...source.matchAll(/datasource\s+\w+\s*\{[\s\S]*?\n\}/g)];
if (blocks.length !== 1) throw new Error(`expected one datasource block, found ${blocks.length}`);
const block = blocks[0][0];
const providerLines = [...block.matchAll(/(^\s*provider\s*=\s*")[^"]+("\s*$)/gm)];
if (providerLines.length !== 1) throw new Error(`expected one datasource provider, found ${providerLines.length}`);
const nextBlock = block.replace(/(^\s*provider\s*=\s*")[^"]+("\s*$)/m, `$1${provider}$2`);
await writeFile("prisma/schema.active.prisma", source.replace(block, nextBlock));
```

Run:

```bash
docker compose -f docker-compose.test.yml up -d postgres
pnpm db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run tests/integration/database-contract.test.ts
```

Expected: the same contract object as SQLite.

- [ ] **Step 4: Create a clean PostgreSQL production migration history**

Archive SQLite migrations under `prisma/migrations-sqlite`, change only the canonical datasource provider value from `sqlite` to `postgresql`, and generate the locked initial migration from an empty source. `migration_lock.toml` contains `provider = "postgresql"`. Append the three reviewed CHECK constraints below to the generated SQL; do not import prototype SQLite data.

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
 }
```

```toml
provider = "postgresql"
```

```sql
ALTER TABLE "Narration"
  ADD CONSTRAINT "Narration_exactly_one_target_check"
  CHECK (("analysisSnapshotId" IS NULL) <> ("scheduleAdviceId" IS NULL));

ALTER TABLE "PlanRevision"
  ADD CONSTRAINT "PlanRevision_trigger_pair_check"
  CHECK (("triggerEntityType" IS NULL) = ("triggerEntityId" IS NULL));

ALTER TABLE "ScheduleAdvice"
  ADD CONSTRAINT "ScheduleAdvice_target_matches_trigger_check"
  CHECK (
    ("triggerType" = 'event' AND "eventId" IS NOT NULL AND "planId" IS NULL)
    OR
    ("triggerType" = 'reroute' AND "eventId" IS NULL AND "planId" IS NOT NULL)
  );

ALTER TABLE "SleepPlan"
  ADD CONSTRAINT "SleepPlan_active_key_check"
  CHECK (("status" = 'active') = ("activeKey" IS NOT NULL));

ALTER TABLE "PlanDay"
  ADD CONSTRAINT "PlanDay_active_key_check"
  CHECK (("status" = 'active') = ("activeKey" IS NOT NULL));

ALTER TABLE "AnalysisSnapshot"
  ADD CONSTRAINT "AnalysisSnapshot_current_key_check"
  CHECK (("status" = 'current') = ("currentKey" IS NOT NULL));

ALTER TABLE "BaselineSnapshot"
  ADD CONSTRAINT "BaselineSnapshot_current_key_check"
  CHECK (("status" = 'current') = ("currentKey" IS NOT NULL));
```

Run:

```bash
git mv prisma/migrations prisma/migrations-sqlite
mkdir -p prisma/migrations/20260819000000_initial_postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20260819000000_initial_postgresql/migration.sql
DATABASE_URL='postgresql://planner:planner@127.0.0.1:5432/planner_test?schema=migration_verification' pnpm verify:migrations
DATABASE_URL='postgresql://planner:planner@127.0.0.1:5432/planner_test?schema=migration_verification' pnpm prisma migrate deploy
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm test:run
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test pnpm playwright test --project=chromium
docker compose -f docker-compose.test.yml down
```

`verify-migrations.ts` refuses to mutate any URL unless host is `127.0.0.1`/`localhost`, database is `planner_test`, and query schema is exactly `migration_verification`. It drops and recreates only that disposable schema, asserts that the lock provider is PostgreSQL, the initial SQL contains all seven named constraints and has no `DROP TABLE`, `TRUNCATE`, or SQLite statements, applies the migration, queries `pg_constraint` for the seven names, and leaves `prisma migrate status` current. Add `"verify:migrations": "tsx scripts/verify-migrations.ts"` to package scripts.

```ts
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is required");
const url = new URL(rawUrl);
const schema = url.searchParams.get("schema");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/planner_test" || schema !== "migration_verification") {
  throw new Error("verify:migrations accepts only local planner_test?schema=migration_verification");
}

const migrationPath = "prisma/migrations/20260819000000_initial_postgresql/migration.sql";
const [lock, sql] = await Promise.all([
  readFile("prisma/migrations/migration_lock.toml", "utf8"),
  readFile(migrationPath, "utf8"),
]);
if (lock.trim() !== 'provider = "postgresql"') throw new Error("unexpected migration provider lock");
const constraints = [
  "Narration_exactly_one_target_check",
  "PlanRevision_trigger_pair_check",
  "ScheduleAdvice_target_matches_trigger_check",
  "SleepPlan_active_key_check",
  "PlanDay_active_key_check",
  "AnalysisSnapshot_current_key_check",
  "BaselineSnapshot_current_key_check",
] as const;
for (const name of constraints) if (!sql.includes(name)) throw new Error(`missing constraint: ${name}`);
if (/\b(DROP\s+TABLE|TRUNCATE|PRAGMA|AUTOINCREMENT)\b/i.test(sql)) throw new Error("unsafe or SQLite SQL in release migration");

const adminUrl = new URL(url);
adminUrl.searchParams.delete("schema");
const client = new Client({ connectionString: adminUrl.toString() });
await client.connect();
try {
  await client.query('DROP SCHEMA IF EXISTS "migration_verification" CASCADE');
  await client.query('CREATE SCHEMA "migration_verification"');
} finally {
  await client.end();
}

execFileSync("pnpm", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl, MIGRATION_DATABASE_URL: rawUrl },
});
const verify = new Client({ connectionString: adminUrl.toString() });
await verify.connect();
try {
  const result = await verify.query<{ conname: string }>(
    `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = $1 AND c.conname = ANY($2::text[])`,
    [schema, constraints],
  );
  if (new Set(result.rows.map(({ conname }) => conname)).size !== constraints.length) throw new Error("database constraints do not match migration");
} finally {
  await verify.end();
}
execFileSync("pnpm", ["prisma", "migrate", "status"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl, MIGRATION_DATABASE_URL: rawUrl },
});
```

- [ ] **Step 5: Add CI provider matrix and deterministic gates**

CI installs with `pnpm install --frozen-lockfile`, then runs:

```bash
pnpm prisma validate
pnpm dlx auth@latest generate --yes --config src/shared/auth/auth.ts --output prisma/schema.auth-check.prisma
pnpm verify:auth-schema
pnpm lint
pnpm typecheck
pnpm test:run
```

`verify-auth-schema.ts` extracts User, Session, Account, Verification, and RateLimit from the generated check schema and asserts that every generated scalar, relation key, unique/index, and mapped field exists in canonical `prisma/schema.prisma`; canonical-only domain relations on User are allowed. Add `prisma/schema.auth-check.prisma` to `.gitignore` and add `"verify:auth-schema": "tsx scripts/verify-auth-schema.ts"` to package scripts.

```ts
import { readFile } from "node:fs/promises";

const [canonical, generated] = await Promise.all([
  readFile("prisma/schema.prisma", "utf8"),
  readFile("prisma/schema.auth-check.prisma", "utf8"),
]);
const names = ["User", "Session", "Account", "Verification", "RateLimit"] as const;
const modelBlock = (source: string, name: string): string => {
  const match = source.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`missing auth model: ${name}`);
  return match[1];
};
const lines = (block: string): Set<string> => new Set(
  block.split("\n").map((line) => line.replace(/\/\/.*$/, "").trim().replace(/\s+/g, " ")).filter(Boolean),
);
for (const name of names) {
  const expected = lines(modelBlock(generated, name));
  const actual = lines(modelBlock(canonical, name));
  const missing = [...expected].filter((line) => !actual.has(line));
  if (missing.length) throw new Error(`${name} auth schema drift:\n${missing.join("\n")}`);
}
```

The provider matrix then runs SQLite and PostgreSQL integration jobs followed by E2E, visual, and build. PostgreSQL uses a dedicated service database. Each parallel worker creates a unique user, idempotency key, database namespace, and timezone fixture. The workflow has four required jobs: `quality` (lint/typecheck/unit), `contract-sqlite`, `contract-postgresql` with a PostgreSQL service and health check, and `browser` after both contracts. `browser` runs migration deploy, migration status, E2E, visual, and build against PostgreSQL; no job shares a mutable SQLite file. Every job removes generated active/auth-check schemas in an `if: always()` cleanup step.

Use this exact job graph; each `setup` block expands to checkout, `pnpm/action-setup@v4`, `actions/setup-node@v4` with Node 22 and pnpm cache, then `pnpm install --frozen-lockfile`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

env:
  BETTER_AUTH_SECRET: test-secret-that-is-at-least-32-characters
  BETTER_AUTH_URL: http://127.0.0.1:3000
  OPENAI_API_KEY: test-key
  OPENAI_MODEL: test-model

jobs:
  quality:
    runs-on: ubuntu-latest
    env: { DATABASE_URL: "postgresql://planner:planner@127.0.0.1:5432/planner_test" }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm dlx auth@latest generate --yes --config src/shared/auth/auth.ts --output prisma/schema.auth-check.prisma
      - run: pnpm verify:auth-schema
      - run: pnpm lint && pnpm typecheck && pnpm test:run tests/unit tests/component
      - if: always()
        run: rm -f prisma/schema.auth-check.prisma prisma/schema.active.prisma

  contract-sqlite:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: "file:./prisma/contract.db"
      AUTH_RATE_LIMIT_ENABLED: "true"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:schema -- --provider sqlite
      - run: pnpm prisma generate --schema prisma/schema.active.prisma
      - run: pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
      - run: pnpm test:run tests/integration
      - if: always()
        run: rm -f prisma/contract.db prisma/schema.active.prisma

  contract-postgresql:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_USER: planner, POSTGRES_PASSWORD: planner, POSTGRES_DB: planner_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U planner -d planner_test"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: "postgresql://planner:planner@127.0.0.1:5432/planner_test"
      AUTH_RATE_LIMIT_ENABLED: "true"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:schema -- --provider postgresql
      - run: pnpm prisma generate --schema prisma/schema.active.prisma
      - run: pnpm prisma db push --schema prisma/schema.active.prisma --force-reset
      - run: pnpm test:run tests/integration
      - if: always()
        run: rm -f prisma/schema.active.prisma

  browser:
    needs: [quality, contract-sqlite, contract-postgresql]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_USER: planner, POSTGRES_PASSWORD: planner, POSTGRES_DB: planner_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U planner -d planner_test"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env: { DATABASE_URL: "postgresql://planner:planner@127.0.0.1:5432/planner_test" }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm prisma generate && pnpm prisma migrate deploy && pnpm prisma migrate status
      - run: pnpm playwright test --project=chromium
      - run: pnpm test:visual
      - run: pnpm build
      - if: always()
        run: rm -f prisma/schema.auth-check.prisma prisma/schema.active.prisma
```

- [ ] **Step 6: Configure Vercel preview and production**

Run `pnpm add -D vercel dotenv-cli`. Set pooled runtime `DATABASE_URL`, direct non-pooled `MIGRATION_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_RATE_LIMIT_ENABLED=true`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. Each preview uses its own PostgreSQL branch/database and exact `https://${VERCEL_URL}` origin; production uses its fixed HTTPS origin. Preview CI pulls its environment into gitignored `.env.preview.local`; Prisma CLI selects `MIGRATION_DATABASE_URL` through `prisma.config.ts`, so `pnpm dotenv -e .env.preview.local -- pnpm prisma migrate deploy` uses the direct endpoint while serverless runtime uses the pooled endpoint. Production migration deploy is a separately approved release job before production promotion, never a serverless request or Next.js build side effect.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm prisma generate && pnpm build"
}
```

Add global response headers in `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Vercel supplies HTTPS/HSTS at the edge; do not send HSTS from local HTTP. The production smoke test asserts these six headers on `/sign-in` and one authenticated route.

`scripts/deploy-preview.mjs` invokes `pnpm vercel deploy --prebuilt --yes` with `execFileSync`, extracts the final stdout line, parses it with `new URL`, rejects non-HTTPS or non-`.vercel.app` hosts, and launches `pnpm playwright test tests/e2e/production-smoke.spec.ts` with that validated origin in `BASE_URL`. This avoids a hand-edited preview URL and ensures smoke tests target the deployment that was just created.

```js
import { execFileSync } from "node:child_process";

const stdout = execFileSync("pnpm", ["vercel", "deploy", "--prebuilt", "--yes"], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "inherit"],
});
const candidates = stdout.match(/https:\/\/[^\s]+\.vercel\.app\/?/g) ?? [];
const deployed = candidates.at(-1);
if (!deployed) throw new Error("Vercel did not return a deployment URL");
const url = new URL(deployed);
if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app")) throw new Error("unexpected deployment origin");
execFileSync("pnpm", ["playwright", "test", "tests/e2e/production-smoke.spec.ts"], {
  stdio: "inherit",
  env: { ...process.env, BASE_URL: url.origin },
});
```

- [ ] **Step 7: Verify backup, rollback, preview, and production smoke**

Before any later production migration, confirm provider snapshot/backup, use expand migration, deploy compatible app code, then apply contract migration. On failure, restore the prior app version and use a forward corrective migration instead of destructive rollback.

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:visual
pnpm playwright test --project=chromium
pnpm build
pnpm vercel pull --yes --environment=preview
pnpm vercel env pull .env.preview.local --yes --environment=preview
pnpm dotenv -e .env.preview.local -- pnpm prisma migrate deploy
pnpm vercel build
node scripts/deploy-preview.mjs
```

`production-smoke.spec.ts` uses a UUID-scoped `@example.invalid` account, exercises sign-up, onboarding, record save, Today, major-event advice/approval, Analyze, Care, Account export, sign-out and sign-in, then deletes that same smoke account through the product confirmation flow in `finally` when a session remains. It never calls an admin cleanup endpoint.

Expected: the complete smoke journey PASSes on the exact PostgreSQL preview URL and the test account is removed.

- [ ] **Step 8: Commit deployment readiness**

```bash
git add prisma scripts docker-compose.test.yml .github/workflows/ci.yml vercel.json next.config.ts tests/integration/database-contract.test.ts tests/e2e/production-smoke.spec.ts package.json pnpm-lock.yaml .env.example .gitignore README.md
git commit -m "chore: prepare postgres vercel deployment"
```

## Final Verification Checklist

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test:run` passes.
- [ ] SQLite and PostgreSQL integration suites return the same contract results.
- [ ] `pnpm playwright test --project=chromium` passes with isolated users.
- [ ] `pnpm test:visual` passes for every manifest frame.
- [ ] `pnpm build` passes with only documented environment variables.
- [ ] No page or action queries Prisma directly.
- [ ] Every user-owned table has direct userId and a tested scope boundary.
- [ ] Record edit/delete appends revisions and recalculates affected snapshots.
- [ ] Major-event and Rerouting advice never changes a plan before confirmation.
- [ ] What-if creates no persistent row until the user submits a real record.
- [ ] LLM failure leaves numeric facts and plans committed and shows a deterministic explanation.
- [ ] Actual integrations are never labeled connected or automatic.
- [ ] Export excludes credentials and account deletion is all-or-nothing.
- [ ] Vercel preview smoke passes before production promotion.
