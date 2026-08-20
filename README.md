# 26_LikelionHackathon

## Task 3 진행 상황 (Prisma + Better Auth 연동)

- 상태: 완료 (로컬 검증 기준)
- 작업 범위: `better-auth`, `@better-auth/prisma-adapter`, `@prisma/client`, `prisma` 및 관련 설정/어댑터를 최신 버전 기준으로 정렬
- 적용 변경:
  - `src/shared/db/database-provider.ts`
  - `src/shared/db/prisma.ts`
  - `src/shared/auth/auth-origin.ts`
  - `src/shared/auth/auth.ts`
  - `src/shared/auth/auth-client.ts`
  - `src/shared/config/env.ts`
  - `src/app/api/auth/[...all]/route.ts`
- `prisma/schema.prisma` 및 `prisma.config.ts`
  - `.env.example`
- 테스트 실행:
- `npm run test:run tests/unit/database-provider.test.ts`
- `npm run test:run tests/unit/auth-origin.test.ts`
- `npm run test:run tests/unit/database-provider.test.ts tests/unit/auth-origin.test.ts tests/integration/auth-handler.test.ts`
- 비고: `db:schema`/`verify` 스크립트는 현재 저장소에 스크립트 파일이 없어 실행되지 못함(파일 미존재 상태)

## 최신 의존성 반영

- `npm update` 실행 후 `npm outdated`가 빈 결과(`{}`)로 확인됨
- `package.json` 및 `package-lock.json`에 최신 버전이 반영됨

## Task 21 품질 게이트

시각 회귀와 접근성 검증은 일반 개발 DB를 절대 사용하지 않습니다. 시각 테스트는 `ADAPTIVE_SLEEP_E2E_DATABASE_URL`에 `file:` 기반의 전용 `e2e` 또는 `playwright` SQLite URL을 설정하고, 해당 DB에 필요한 스키마를 준비한 뒤에만 실행합니다.

계획된 검증 순서:

```bash
npm run test:visual
npm exec -- playwright test tests/e2e/accessibility.spec.ts --project=chromium
npm run test:run
npm run lint
npm run typecheck
npm run build
```

`test:visual`은 `VISUAL_TEST=1`과 전용 DB URL을 요구하고, 프레임마다 `.invalid` 도메인의 고유 Better Auth 사용자를 만든 뒤 그 사용자 행만 시드합니다. 시드 작업은 User, Account, Session을 삭제하지 않습니다. 외부 네트워크와 OpenAI 브라우저 요청은 차단되며, 폰트는 CDN이 아니라 설치된 `pretendard` 패키지에서 로드됩니다.

GitHub Actions의 `visual-tests` environment에는 사전 마이그레이션된 전용 DB를 가리키는 `ADAPTIVE_SLEEP_E2E_DATABASE_URL` variable이 필요합니다. 이 게이트는 수동 실행에서만 활성화됩니다.

스크린샷 기준선은 일반 CI에서 자동 생성하지 않습니다. 기준선 후보를 만들 때만 수동 `visual-tests` workflow의 `visual_mode=capture` 또는 아래 명령을 사용하고, 생성된 파일을 시각 검토 후 커밋합니다.

```bash
npm run test:visual -- --update-snapshots
```

커밋된 기준선이 존재한 뒤에는 수동 workflow의 `visual_mode=compare`가 `npm run test:visual`로 엄격 비교합니다.

## Task 22 deployment readiness

The canonical Prisma schema targets PostgreSQL. The archived SQLite history is retained under `prisma/migrations-sqlite/` only for local parity work; production uses the clean PostgreSQL history in `prisma/migrations/`. Runtime `DATABASE_URL` must be the provider's pooled serverless endpoint.

Deployment monitoring uses `GET /api/health` only for liveness and `GET /api/ready` for bounded PostgreSQL readiness. The readiness response is deliberately generic and non-cacheable; details are documented in `docs/operations.md` and are never exposed by the endpoint.

`scripts/verify-migrations.ts` refuses every target except `postgresql://...@(127.0.0.1|localhost)/planner_test?schema=migration_verification`. It verifies the PostgreSQL lock, migration safety, and all release CHECK constraints before applying anything. The CI matrix uses disposable SQLite and PostgreSQL contract databases and an isolated PostgreSQL `e2e_browser` schema for browser tests.

Required deployment environment values, to be supplied only during external setup:

```bash
DATABASE_URL=postgresql://...pooled-serverless-endpoint...
BETTER_AUTH_SECRET=<at-least-32-random-bytes>
BETTER_AUTH_URL=https://<exact-preview-or-production-origin>
AUTH_RATE_LIMIT_ENABLED=true
OPENAI_API_KEY=<server-only-key>
OPENAI_MODEL=gpt-5.6-terra
```

Do not run migrations from a Vercel request, Vercel build, or runtime environment. Keep `MIGRATION_DATABASE_URL` only in the separately approved `guarded database migration` workflow/secret context (see `.env.migration.example` and `docs/operations.md`), then run `prisma migrate deploy` there before release promotion. The `preview release` workflow validates runtime values without logging them, builds, deploys, and passes the exact HTTPS `.vercel.app` URL returned by Vercel to the remote-only production smoke project. Before production, verify the database provider snapshot, deploy compatible application code, and use forward corrective migrations rather than destructive rollback.

Planned validation, deliberately not run in this task:

```bash
npm run db:schema -- --provider sqlite
DATABASE_URL=file:./prisma/contract.db npm exec -- prisma generate --schema prisma/schema.active.prisma
DATABASE_URL=file:./prisma/contract.db npm run test:run tests/integration/database-contract.test.ts
docker compose -f docker-compose.test.yml up -d postgres
npm run db:schema -- --provider postgresql
DATABASE_URL=postgresql://planner:planner@127.0.0.1:5432/planner_test npm exec -- prisma generate --schema prisma/schema.active.prisma
DATABASE_URL='postgresql://planner:planner@127.0.0.1:5432/planner_test?schema=migration_verification' npm run verify:migrations
npm run lint && npm run typecheck && npm run test:run && npm run test:visual && npm run build
```
