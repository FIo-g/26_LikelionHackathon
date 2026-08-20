# Adaptive Sleep Planner Repair Design

- 작성일: 2026-08-20
- 상태: 사용자 채팅 승인 완료, 문서 검토 대기
- 기준 명세: `docs/superpowers/specs/2026-08-19-adaptive-sleep-planner-design.md`
- 기준 구현 계획: `docs/superpowers/plans/2026-08-19-adaptive-sleep-planner.md`

## 1. 목적

현재 `main` 구현을 기준 명세와 계획에 맞는 동작 가능한 상태로 복구한다. 범위는 코드리뷰에서 확인된 인증, 데이터베이스, 온보딩, 기록, 분석, 계획, 내레이션, Care, Account, UI, 접근성, 테스트 및 배포 게이트의 모든 결함이다.

새 제품 범위를 추가하거나 기존 모듈형 모놀리스 구조를 전면 재작성하지 않는다. 기존 계층 경계인 UI → application → domain → repository → Prisma를 유지하면서 잘못 연결된 계약과 누락된 검증을 복구한다.

## 2. 선택한 접근

### 선택: 계약 우선의 단계적 안정화

각 결함을 사용자 관점의 회귀 테스트로 먼저 재현하고, 가장 낮은 계층의 원인을 수정한 뒤 상위 흐름을 연결한다. 수정 순서는 다음과 같다.

1. npm, ESLint, TypeScript, Prisma driver adapter, Better Auth와 빌드 기반
2. 온보딩, 직접 입력 CRUD, IANA timezone, transaction과 idempotency
3. Baseline, Analysis, Today, Planner, Narration, Care 계산 계약
4. AppShell, 반응형 화면, 개인정보 보호와 접근성
5. migration, SQLite/PostgreSQL contract, E2E 격리, visual gate와 production smoke

이 방식은 현재 repository와 application interface를 보존하며 수정별 실패 원인을 분리할 수 있다.

### 거절한 접근

- 전면 재작성: 명세 범위가 넓어 누락과 데이터 호환 회귀 위험이 커진다.
- 빌드 차단 오류만 수정: 애플리케이션이 컴파일되어도 인증, 기록, 분석, 계획 흐름이 계속 실패하므로 완료 조건을 충족하지 못한다.

## 3. 기반과 의존성 계약

- 패키지 관리자는 npm만 사용하고 `package-lock.json`을 단일 lockfile로 유지한다.
- Next.js, React, Prisma, Better Auth 등은 공식 peer와 runtime 범위를 만족하는 최신 안정 버전을 사용한다.
- ESLint와 TypeScript는 숫자상 최신 major가 아니라 현재 Next.js 및 lint toolchain과 호환되는 최신 버전을 사용한다.
- Prisma 7 client는 PostgreSQL과 SQLite 모두 명시적 driver adapter로 생성한다.
- CI에서 실행하는 Better Auth 및 Vercel CLI는 package manifest와 lockfile에 고정한다.
- Next.js 16의 async `params`, `searchParams`, cookies와 headers 계약을 모든 route에서 지킨다.

## 4. 인증과 사용자 소유권

Better Auth는 database provider를 Prisma adapter에 명시하고 초기화 오류를 fallback 성공처럼 숨기지 않는다. 브라우저 client는 배포 origin에 종속되지 않는 same-origin 인증 경로를 사용한다.

모든 사용자 소유 모델은 직접 `userId`를 가지고 User 관계와 cascade를 설정한다. 가능한 자식 모델은 parent id와 userId를 함께 검증한다. 계정 삭제, 직접 User 삭제, 동시 onboarding write 어느 경우에도 orphan 설정 데이터가 남지 않아야 한다.

인증 통합 테스트는 handler 함수 존재가 아니라 실제 회원가입, 로그인, 세션 조회, 로그아웃과 보호 route를 검증한다.

## 5. 시간과 직접 입력

브라우저의 `datetime-local` 값은 저장된 IANA timezone과 Temporal을 사용해 UTC instant로 변환한다. DST gap은 거부하고 반복 시각은 명시적 offset 선택 없이는 저장하지 않는다. 기본 폼 값과 화면 포맷도 동일 timezone을 사용한다.

Record intake draft는 URL에 넣지 않고 pathname별 `sessionStorage`에 저장한다. 모든 category는 create, edit, delete를 지원하며 edit에는 기존 ID와 값을 전달한다. 날짜가 변경되는 update는 이전 날짜와 새 날짜가 영향을 주는 모든 rolling snapshot을 재계산한다.

MutationReceipt request hash는 operation, idempotency key 및 정규화된 command body를 포함한다. 동일 키와 동일 body는 이전 결과를 반환하고, 동일 키와 다른 body는 conflict를 반환한다. PostgreSQL unique race는 실패한 transaction 밖에서 winner receipt를 다시 읽는다.

## 6. 분석, 계획과 Care

BaselineSnapshot과 AnalysisSnapshot은 versioned JSON과 64 KiB 제한을 쓰기와 읽기 모두에서 검증한다. 누락 필드 순서는 schema와 engine에서 하나의 의미 순서로 공유한다. readiness는 수면시간이 없을 때만 null이며 나머지 누락은 관측 가중치를 재정규화한다.

Sleep Impact는 명세의 카페인 잔존량, 휴대폰, 식사, 운동 cutoff를 사용하고 누락값은 어느 cohort에도 넣지 않는다. 행동은 수면의 기상일 row가 아니라 실제 수면 구간과 target bed에 연결한다.

Today ViewModel은 snapshot entity와 validated result를 구분한다. corrupt current snapshot은 last-good을 stale로 사용하거나 error를 표시하며, insufficient와 혼동하지 않는다.

Rerouting hash는 현재 active PlanDay와 revision을 포함한다. 화면의 시간은 사용자 timezone으로 포맷한다. LLM narration 검증은 숫자의 존재가 아니라 metric id와 값의 의미 대응을 확인하며, 숫자와 계획은 항상 규칙 엔진 결과에서 렌더링한다.

Care는 PlanDay의 localDate가 기상일이라는 계약으로 오늘 밤의 day를 선택한다. 루틴은 실제 실행 시각순으로 정렬하고 timer는 callback 횟수가 아니라 monotonic elapsed time을 사용한다.

## 7. UI, 개인정보와 접근성

보호 route group은 데스크톱 sidebar, 모바일 bottom navigation과 Account 진입을 포함한 AppShell을 렌더링한다. JS와 CSS는 하나의 responsive breakpoint source를 사용하고 641–767px에서도 모든 핵심 CTA를 보존한다.

건강 입력값은 query string, 로그 또는 브라우저 history에 남기지 않는다. 필드 오류는 `aria-invalid`와 설명 요소로 연결하고 제출 결과는 live region으로 발표한다. progressbar, Care 상태, dialog focus와 Escape 동작을 WCAG 기준으로 검증한다.

## 8. 데이터베이스와 배포 게이트

SQLite와 PostgreSQL은 동일 canonical model에서 adapter만 바꾸어 contract test를 실행한다. SQLite migration history는 빈 데이터베이스부터 적용 가능해야 하며 PostgreSQL CHECK 제약과 migration drift verifier를 CI에서 실행한다.

E2E setup은 worker별 고유 user와 namespace를 사용한다. production smoke의 cleanup은 현재 page와 무관하게 API 또는 직접 cleanup use case로 반드시 실행하고, sign-out/sign-in 재검증과 export download 검증을 포함한다.

visual manifest의 모든 frame에는 committed baseline이 있어야 한다. baseline이 없거나 frame이 누락되면 skip이 아니라 실패한다.

## 9. 테스트와 완료 조건

각 production 변경은 다음 순서를 따른다.

1. 최소 회귀 테스트 추가
2. 예상 원인으로 실패하는지 확인
3. 최소 수정
4. 대상 테스트와 인접 suite 통과
5. 영역별 리뷰 후 전체 gate 실행

최종 완료 조건은 다음 명령과 실제 browser/database 흐름이 모두 성공하는 것이다.

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- SQLite 및 PostgreSQL contract test
- Chromium E2E와 accessibility test
- visual manifest 전체 frame 비교
- preview production smoke

환경 자격증명이나 외부 배포가 없어 실행할 수 없는 검증은 로컬에서 동등한 deterministic contract를 실행하고, 외부 검증은 미실행 상태를 성공으로 표현하지 않는다.
