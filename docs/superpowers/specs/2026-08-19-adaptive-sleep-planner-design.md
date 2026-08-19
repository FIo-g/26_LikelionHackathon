# Adaptive Sleep Planner 구현 설계

- 작성일: 2026-08-19
- 상태: 자기검토 완료, 사용자 최종 검토 대기
- 대상: Next.js 반응형 웹 애플리케이션
- 주요 기술: Next.js App Router, TypeScript, Prisma, SQLite, PostgreSQL, Better Auth

## 1. 목적

Adaptive Sleep Planner는 수면 기록을 단순히 나열하는 서비스가 아니다. 사용자가 직접 입력한 수면·카페인·음주·식사·운동·휴대폰 사용 기록을 바탕으로 오늘의 준비 상태와 행동 제안을 보여주고, 중요한 일정에 맞춘 수면 계획과 계획 이탈 후 재조정 기능을 제공한다.

이번 구현은 Figma의 활성 화면과 사용자 흐름 전체를 반응형 웹으로 구현하는 것을 목표로 한다. Notion 문서는 제품 의도와 분석 항목을 이해하기 위한 기획 자료로 사용한다. 두 자료가 충돌할 경우 우선순위는 다음과 같다.

1. 대화에서 확정한 사용자 결정
2. Figma의 활성 디자인과 제품 흐름
3. Notion의 기능 기획

## 2. 확정된 범위

### 포함

- 이메일·비밀번호 회원가입, 로그인, 로그아웃과 사용자별 데이터 분리
- 전체 온보딩
- 데스크톱과 모바일 반응형 화면
- 수면·카페인·음주·식사·운동·휴대폰 사용·주관적 상태 직접 입력
- Today, Record, Plan, Analyze, Care, Account 전 화면
- 임시 규칙 기반 Baseline, Readiness, Confidence, Sleep Impact
- What-if, 주요 일정 계획, Rerouting
- 주요 일정 추가 후 AI 일정 조정 제안
- 규칙 엔진 결과만 설명하는 LLM 내레이션
- 프로필, 수면 목표, 연결 상태, 데이터 관리
- SQLite 기반 초기 검증
- PostgreSQL 전환 후 Vercel 배포

### 후속 과업

- 네이티브 iOS·Android 앱
- HealthKit·Health Connect 실제 연동
- 스마트폰 센서와 휴대폰 사용시간 자동 동기화
- Google·Apple 캘린더 실제 연동
- 네이티브 앱용 공개 API

후속 연동 버튼과 상태는 Figma에 맞게 렌더링하되 실제 연결처럼 오해되지 않도록 “추후 지원” 또는 “준비 중”으로 표시한다.

### 제외

- Figma의 Archive / Earlier MVP drafts
- 의료 진단, 치료·약물 추천
- 수면 단계 추정
- 코골이 AI, Raw PPG 분석
- 대규모 ASMR 콘텐츠 플랫폼

## 3. Figma 구현 추적표

| Figma 페이지 | 구현 내용 |
|---|---|
| Cover | 구현 범위와 제품 정체성을 확인하는 참조 페이지 |
| Foundations | 색상, 타이포그래피, 8pt 간격, 반경, 레이아웃 토큰 |
| Components / Routine Step | upcoming, current, done 상태와 현재 단계 CTA |
| Components / Care Tool | 호흡 가이드, 백색소음, ASMR 등 케어 도구 카드 |
| Components / Sync Status | manual, automatic 및 pending, syncing, complete, error 상태 |
| Screens / Care | Desktop / Care와 Mobile / Care |
| Screens / Product Flow | 가입 → 오늘 → 기록 → 계획 → 분석 → 케어·설정 |
| Screens / Auth & Onboarding | Desktop / Sign in과 모바일 Connect, Sleep goal, Habits, Basic profile |
| Screens / Today | Desktop / Today |
| Screens / Intake Flows | Sleep & Phone, Meal & Health, Caffeine, Alcohol 입력 플로우 |
| Screens / Record Hub | Desktop / Record hub와 Mobile / Record hub |
| Screens / Plan | Desktop / Plan과 모바일 반응형 Plan |
| Screens / Analyze | Desktop / Analyze와 모바일 반응형 Analyze |
| Screens / Account | Desktop / Account & Settings와 모바일 반응형 Account |
| Screens / Responsive Mobile | Mobile / Today, Plan, Analyze, Account와 하단 내비게이션 |

Product Flow의 번호와 라우트 매핑은 다음으로 고정한다.

1. 인증·가입과 온보딩: /sign-in, /sign-up, /onboarding/*
2. 오늘: /today
3. 기록: /record와 /record/*
4. 계획: /plan
5. 분석: /analyze
6. 케어·설정: /care와 /account

시각 회귀 테스트는 실제 런타임 화면 프레임만 대상으로 한다. Foundations, Product Flow, 컴포넌트 문서 페이지, Cover는 구현 근거이지만 스크린샷 비교 대상은 아니다. 각 런타임 프레임은 route, viewport, seed fixture를 visual-regression manifest에 명시한다.

## 4. 전체 아키텍처

애플리케이션은 Next.js App Router 기반 모듈형 모놀리스로 구성한다.

의존 방향은 다음과 같다.

UI → application use case → domain rule → repository interface → Prisma

### 계층별 책임

- UI: Figma 화면 렌더링, 사용자 입력, 접근성, 반응형 배치
- Application: 하나의 사용자 행동을 완결하는 use case와 transaction 경계
- Domain: Baseline, Confidence, What-if, 주요 일정 제안, Rerouting 순수 함수
- Repository: 사용자 범위가 적용된 데이터 조회·저장 계약
- Infrastructure: Prisma, Better Auth, LLM provider

Server Component는 읽기 전용 application query를 직접 호출한다. Client Component는 시간 선택, 단계형 입력, 차트 상호작용처럼 브라우저 상태가 필요한 부분에만 사용한다. 변경 작업은 Server Action에서 세션과 입력값을 확인한 뒤 application use case를 호출한다.

현재는 네이티브 앱용 공개 API를 만들지 않는다. 다만 Server Action 안에 도메인 규칙이나 Prisma 호출을 직접 작성하지 않아, 후속 과업에서 같은 use case를 Route Handler로 감쌀 수 있도록 유지한다.

### 기능 모듈

- auth: Better Auth, 보호 라우트, 사용자 컨텍스트
- onboarding: 연결 선택, 수면 목표, 습관, 기본정보
- records: 직접 입력과 Record Hub
- baseline: 개인 기준선 계산
- analysis: Readiness, Confidence, Sleep Impact, 근거
- planner: 주요 일정, 1~2주 계획, What-if, Rerouting
- care: 밤 케어 루틴과 도구
- narration: LLM 설명과 템플릿 fallback
- account: 프로필, 목표, 연결 상태, 데이터 관리

## 5. 라우트와 화면 구성

| 라우트 | 화면과 책임 |
|---|---|
| / | 세션과 온보딩 상태에 따라 sign-in, onboarding, today로 이동 |
| /sign-in | 이메일·비밀번호 로그인 |
| /sign-up | Sign in의 AuthShell을 재사용한 이메일·비밀번호 회원가입 |
| /onboarding/connect | 자동 연동의 후속 지원 상태와 직접 입력 선택 |
| /onboarding/sleep-goal | 목표 취침·기상 시각 |
| /onboarding/habits | 카페인·운동·식사·휴대폰 사용 습관 |
| /onboarding/profile | 닉네임과 기본 프로필 |
| /today | Readiness, 데이터 상태, 준비 타임라인, 기록 요약 |
| /record | 데스크톱·모바일 Record Hub |
| /record/caffeine | 브랜드 → 메뉴·용량 → 확인 |
| /record/alcohol | 종류 → 양 → 확인 |
| /record/meal-health | 식사, 운동, 주관적 상태 |
| /record/sleep-phone | 어젯밤 수면과 휴대폰 사용 직접 입력 |
| /plan | 캘린더, 주요 일정, 수면 계획, AI 일정 제안 |
| /analyze | 지표, 2주 추세, 카페인 프로필, 근거, AI 리포트 |
| /care | 오늘 밤 케어, 루틴 단계, 케어 도구 |
| /account | 프로필, 수면 목표, 연결, 데이터 관리 탭 |

Figma에는 별도 Sign up 프레임이 없으므로 /sign-up은 Desktop / Sign in의 셸, 타이포그래피, 입력 스타일을 재사용한 기능 파생 화면으로 구현한다. 이 화면은 기능 E2E 대상이지만 Figma 시각 회귀 대상은 아니다.

What-if는 별도 상위 내비게이션을 추가하지 않는다. Analyze의 CaffeineProfile에서 “지금 마셔도 될까?” 보조 패널을 열어 가상 카페인 행동을 비교한다. 가상 입력은 저장하지 않으며, 사용자가 “실제 기록으로 추가”를 선택한 경우에만 CaffeineEntry 생성 흐름으로 넘긴다.

데스크톱과 모바일은 별도 URL을 만들지 않는다. 데스크톱은 사이드바, 모바일은 하단 내비게이션을 사용한다. 구조 차이가 작은 화면은 CSS Grid, Flexbox, container query로 대응한다. 정보 우선순위가 크게 다른 화면만 DesktopLayout과 MobileLayout 표현 컴포넌트를 분리하며, 두 컴포넌트는 같은 ViewModel과 도메인 컴포넌트를 사용한다.

모바일의 구체적인 축약 규칙은 다음과 같다.

- Mobile Plan: 2주 전체 표 대신 근접한 날짜의 agenda와 일별 조언을 우선 표시하되 일정 추가와 계획 반영 CTA는 유지
- Mobile Analyze: 핵심 지표 2개와 AI report를 먼저 표시하고 “전체 지표·근거 보기”로 4개 지표, 추세, Data basis에 접근
- Mobile Account: 프로필·목표·연결 요약을 먼저 표시하고 상세 수정과 데이터 관리는 bottom sheet 또는 접이식 섹션으로 제공

Figma의 Intake 원본 프레임은 모바일 기준이다. 모바일 전체 화면과 확인 단계를 시각 기준으로 우선 구현한다. 데스크톱 modal 또는 side panel은 같은 모바일 흐름의 반응형 파생 표현이며 별도의 Figma 시각 회귀 기준으로 간주하지 않는다.

## 6. 공통 컴포넌트와 상태

### 공통 셸

- AppShell
- DesktopSidebar
- MobileBottomNavigation
- PageHeader
- Modal
- BottomSheet
- EmptyState
- ErrorState

### 디자인 시스템

- Button
- Card
- Field
- TimePicker
- StatusPill
- MetricCard
- ChartFrame
- Progress
- ConfirmationDialog

Figma Foundations의 값은 CSS 의미 토큰으로 옮긴다. 페이지 컴포넌트에서 원시 색상값을 직접 사용하지 않는다.

### 기능 컴포넌트

- OnboardingProgress, DeviceConnectOption, HabitSelector
- ReadinessCard, DataStatusCard, PreparationTimeline, RecordStatusSummary
- RecordCategoryCard, BrandPicker, MenuPicker, QuantityPicker, RecordConfirmation
- PlanCalendar, MajorEventForm, TwoWeekPlanStrip, ScheduleAdviceCard
- MetricGrid, SleepTrendChart, CaffeineProfile, ExplainabilityCard, DataBasisPanel
- CareHero, SyncSummary, RoutineTimeline, RoutineStep, CareToolGrid
- ProfileForm, SleepGoalCard, ConnectionList, DataManagement

### 상태 타입

- EntryPresence: empty, draft, completed, error
- RoutineStatus: upcoming, current, done
- SyncMode: manual, automatic
- SyncAvailability: available, coming-soon
- SyncState: needs-input, syncing, complete, error
- ConfidenceLevel: insufficient, low, medium, high
- ScheduleAdviceStatus: generated, accepted, dismissed, superseded, failed
- PlanLifecycle: draft, active, completed, superseded
- SnapshotStatus: current, superseded
- NarrationStatus: pending, ready, template-fallback, failed

EntryPresence와 Sync 상태를 분리해 “추가”, “수정”, “직접 입력 사용 중” 레이블을 정확히 만든다. 현재 범위에서 허용되는 조합은 manual + available + needs-input 또는 complete뿐이다. automatic과 syncing은 디자인 시스템으로만 구현하고 실제 데이터 연동이 열리기 전에는 활성화하지 않는다. Figma의 “연동됨”, “자동 입력” 카피는 현재 구현에서 “직접 입력 사용 중” 또는 “추후 지원”으로 바꿔 실제 동기화로 오인되지 않게 한다.

Today query는 화면 전체를 하나의 성공·실패 상태로 뭉치지 않고 Readiness, DataStatus, PreparationTimeline, RecordSummary별 ViewModel을 만든다. 각 영역은 ready, insufficient, stale, error 중 하나의 표시 상태와 마지막 정상 데이터, 오류 시 가능한 CTA를 갖는다. 한 영역 계산이 실패해도 나머지 Today 데이터는 표시한다.

RoutineStep의 상태는 별도 상태값을 중복 저장하지 않고 PlanDay의 시각, 현재 현지 시각, RoutineCompletion으로 계산한다. 완료 기록이 있으면 done, 실행 시각이 지난 첫 미완료 단계는 current, 나머지는 upcoming이다. 같은 localDate가 끝나기 전에는 완료를 취소할 수 있으며, 날짜가 끝났거나 해당 PlanDay가 superseded된 뒤에는 과거 기록을 변경하지 않는다.

Care 도구는 Figma 카드가 약속하는 작은 기능 범위로 구현한다.

- 호흡 가이드: 정해진 박자의 애니메이션과 시작·일시정지·종료 타이머
- 백색소음: 브라우저 Web Audio로 생성하는 소리와 재생 시간 타이머
- ASMR·수면 가이드: 번들된 짧은 음원 또는 시간 제한 가이드 패널과 재생 제어

도구 시작과 정상 완료는 CareToolSession으로 기록한다. 외부 콘텐츠 탐색, 추천 피드, 스트리밍 카탈로그는 만들지 않는다.

## 7. 인증과 사용자 격리

Better Auth의 Next.js 통합과 Prisma adapter를 사용한다.

- 이메일·비밀번호 인증 활성화
- Better Auth handler를 /api/auth/[...all]에 연결
- Better Auth가 생성하는 User, Session, Account, Verification 모델 사용
- 기본 scrypt 비밀번호 해시 사용
- BETTER_AUTH_SECRET과 BETTER_AUTH_URL은 서버 환경변수로 관리
- OAuth는 이번 범위에서 제외

Better Auth CLI는 Prisma schema 생성에 사용하고, 데이터베이스 변경은 Prisma migration으로 적용한다. 별도의 Credential 또는 자체 Session 테이블을 만들지 않는다.

보호된 route group과 모든 Server Action은 서버에서 세션을 다시 확인한다. 클라이언트가 전달한 userId는 신뢰하지 않으며, repository 호출에는 세션에서 얻은 userId를 강제로 주입한다.

Repository는 임의 userId를 매번 넘기는 형태 대신 세션에서만 만들 수 있는 UserScope로 생성한다. 공개 메서드는 이 범위를 생략할 수 없고, ID로 자식 데이터를 수정할 때는 같은 transaction 안에서 부모의 userId 소유권을 먼저 확인한다. 이 구조와 통합 테스트로 누락된 `where userId` 필터를 방지한다.

인증 schema 변경 절차는 Better Auth 설정 변경 → Better Auth generate 실행 → 생성된 Prisma 모델 diff 검토 → Prisma migration 생성 순서로 단일화한다. Better Auth가 DB migration을 직접 실행하지 않는다. CI는 Prisma validate와 migration diff를 실행해 auth schema drift를 차단한다.

Production은 고정 BETTER_AUTH_URL을 사용한다. Vercel preview는 배포별 URL을 Better Auth의 base URL과 trusted origins에 주입해 preview 로그인과 cookie 검증이 production 설정에 의존하지 않게 한다. 허용 origin은 환경별 정확한 HTTPS origin 목록으로 제한하고 wildcard를 사용하지 않는다.

온보딩은 Connect, Sleep goal, Habits, Basic profile의 4단계 진행률과 뒤로가기를 제공한다. 각 단계는 완료할 때 즉시 사용자 소유 설정에 저장되어 중간 이탈 후 복원된다. 마지막 Basic profile 제출은 하나의 transaction에서 필요한 네 단계 데이터가 모두 존재하는지 확인하고 onboardingCompletedAt을 기록한 뒤 /today로 이동한다. 뒤로가기는 저장된 이전 단계 값을 다시 표시한다.

## 8. 데이터 모델

### Better Auth 관리

- User
- Session
- Account
- Verification

### 사용자 설정

- UserProfile: userId, nickname, 기본정보, timezone, onboardingCompletedAt
- SleepGoal: userId, targetBedTime, targetWakeTime, targetDurationMinutes
- UserHabit: userId, type, frequency, value
- Connection: userId, type, mode, availability, state, lastSyncedAt

Connection은 현재 manual + available 또는 automatic + coming-soon 조합만 실제 화면에서 사용한다. 직접 입력에는 lastSyncedAt을 기록하지 않고 마지막 입력 시각을 별도 Record 요약에서 보여준다.

### 직접 입력

- DailyLog: userId, localDate, timezone
- SleepSession: userId, dailyLogId, sleepDate, startedAt, endedAt, morningFatigue, source
- CaffeineEntry: userId, dailyLogId, brand, product, caffeineMg, consumedAt
- AlcoholEntry: userId, dailyLogId, type, servings, consumedAt
- MealEntry: userId, dailyLogId, size, eatenAt, notes
- ExerciseEntry: userId, dailyLogId, type, intensity, startedAt, endedAt, averageHeartRate
- PhoneUsageEntry: userId, dailyLogId, localDate, lastUseAt, durationMinutes, source
- WellnessEntry: userId, dailyLogId, localDate, fatigueLevel, stressLevel
- RecordRevision: userId, entityType, entityId, operation, beforeSnapshot, afterSnapshot, changedAt

DailyLog는 사용자와 localDate 조합으로 유일하다. SleepSession의 sleepDate는 수면 시작일이 아니라 기상한 현지 날짜다.

### 계획

- SpecialEvent: userId, title, type, startsAt, desiredWakeAt, notes
- ScheduleAdvice: userId, eventId?, planId?, triggerType, status, algorithmVersion, inputSnapshot, proposal, confidence, generatedAt
- SleepPlan: userId, eventId, startsOn, endsOn, status, algorithmVersion
- PlanDay: userId, planId, localDate, status, targetBedAt, targetWakeAt, caffeineCutoffAt, exerciseCutoffAt, mealCutoffAt, windDownAt
- PlanRevision: userId, planId, triggerType, triggerEntityType, triggerEntityId, beforeSnapshot, afterSnapshot, reason, createdAt

### 분석

- BaselineSnapshot: userId, dateRange, status, algorithmVersion, values, sampleSize, generatedAt, supersededAt
- AnalysisSnapshot: userId, localDate, status, algorithmVersion, readiness, confidence, dataBasis, missingFields, generatedAt, supersededAt
- ImpactFactor: userId, snapshotId, type, direction, strength, confidence, evidence
- Narration: userId, analysisSnapshotId 또는 scheduleAdviceId, provider, model, inputHash, output, status, generatedAt

### 케어

- RoutineCompletion: userId, localDate, stepKey, completedAt
- CareToolSession: userId, localDate, toolKey, startedAt, plannedDurationSeconds, completedAt

정적 케어 도구 목록은 코드 설정으로 관리하고 CareToolSession에는 실행 이력만 저장한다.

### 요청 중복 방지

- MutationReceipt: userId, operation, idempotencyKey, status, resourceType, resourceId, expiresAt

`userId + operation + idempotencyKey`를 unique로 두며 기본 보존 시간은 24시간이다. 같은 키의 재요청은 이미 생성한 레코드나 PlanRevision을 반환하고 변경을 다시 실행하지 않는다.

### 소유권과 관계 규칙

Better Auth 테이블을 제외한 모든 사용자 소유 테이블은 직접 userId를 가진다. DailyLog에만 간접 의존하거나 클라이언트가 넘긴 부모 ID만으로 소유권을 추정하지 않는다.

- User 삭제 시 사용자 소유 도메인 데이터는 cascade 대상이 된다.
- 자식 테이블은 가능한 경우 `parentId + userId` 복합 외래키로 부모와 동일 사용자임을 보장한다.
- 모든 사용자 조회 경로에는 `userId + localDate`, `userId + createdAt`, `userId + status`처럼 실제 필터·정렬에 맞춘 인덱스를 둔다.
- PlanRevision의 triggerEntityType과 triggerEntityId는 둘 다 존재하거나 둘 다 null이어야 한다.
- ScheduleAdvice는 최초 일정 제안이면 eventId, 재계획 제안이면 planId를 반드시 가진다.
- Narration은 analysisSnapshotId와 scheduleAdviceId 중 정확히 하나만 가져야 한다.

마지막 두 규칙은 SQLite 단계에서는 application validation과 통합 테스트로 강제하고, PostgreSQL 전환 시 CHECK constraint migration도 추가한다.

### 시간과 날짜 규칙

- 실제 시각은 UTC timestamp, 날짜별 화면 기준은 `YYYY-MM-DD` localDate, 지역은 IANA timezone으로 저장한다.
- SleepSession은 잠든 날이 아니라 깨어난 시점의 localDate에 귀속한다.
- 사용자가 timezone을 바꾸면 이후 새 기록과 계획부터 적용하며 과거 localDate와 timezone은 다시 투영하지 않는다.
- DST로 존재하지 않는 현지 시각은 저장하지 않고 수정 안내를 표시한다.
- DST 반복 구간의 모호한 현지 시각은 첫 번째·두 번째 offset을 UI에서 명시적으로 선택하게 하며 임의로 고르지 않는다.

### JSON 계약

inputSnapshot, proposal, beforeSnapshot, afterSnapshot, values, dataBasis, evidence 등 JSON 필드는 모두 `{ schemaVersion, ...payload }` envelope을 사용한다. 쓰기와 읽기 양쪽에서 버전별 Zod schema로 검증하고, 직렬화 크기는 필드당 64 KiB로 제한한다. 알 수 없는 버전이나 손상된 값은 계산에 사용하지 않고 해당 영역을 stale 또는 error로 표시한다.

### 데이터베이스 호환성

- ID는 문자열 UUID 사용
- 상태값은 애플리케이션 schema로 검증
- 계산 근거와 입력 스냅샷은 JSON 사용
- DB 전용 native type 의존 최소화
- 모든 시간은 UTC timestamp로 저장하고 timezone과 localDate를 함께 보관
- SQLite와 PostgreSQL에서 의미가 달라지는 raw SQL, DB enum, 대소문자 암묵 비교에 의존하지 않음

## 9. 저장과 재계산 흐름

1. Server Action이 Better Auth 세션을 확인하고 UserScope를 만든다.
2. Zod schema가 입력 형식, timezone, 시각, 수량, 범위와 JSON 크기를 검증한다.
3. 클라이언트가 생성한 UUID idempotency key로 기존 MutationReceipt를 확인한다.
4. 하나의 Prisma transaction에서 MutationReceipt, 직접 입력, RecordRevision을 저장한다.
5. 변경된 날짜가 포함되는 14일 rolling window의 Baseline과 AnalysisSnapshot을 다시 계산한다.
6. 이전 계산 결과는 삭제하지 않고 superseded 처리하며 새 snapshot을 현재 결과로 지정한다.
7. 활성 계획과 충돌하면 수치가 확정된 Rerouting ScheduleAdvice와 pending Narration을 생성한다.
8. transaction을 commit한 다음 LLM 내레이션을 요청한다.
9. 응답을 검증해 Narration을 ready로 바꾸거나 규칙 기반 한국어 템플릿을 저장하고 template-fallback으로 바꾼다.
10. 관련 Today, Record, Plan, Analyze 화면 캐시를 갱신한다.

LLM 호출은 DB transaction 안에서 수행하지 않는다. LLM timeout이나 요청 중단은 이미 저장된 기록과 계산을 rollback하지 않는다. 다음 화면 조회에서 오래된 pending 내레이션을 발견하면 즉시 deterministic template을 표시하고 제한된 횟수로 재시도할 수 있다.

수정·삭제도 같은 흐름을 사용한다. RecordRevision에 변경 전후를 남기고, 영향을 받는 snapshot과 아직 수락되지 않은 advice를 superseded한 뒤 새 결과를 append한다. 이미 수락한 PlanRevision과 과거 PlanDay는 수정하지 않고 새 revision으로 후속 변경을 표현한다.

변경된 기록일 D는 D부터 D+13일까지 중 이미 계산된 날짜와 현재 날짜를 재계산 대상으로 삼는다. 활성 SleepPlan이 있으면 trigger 시각 이후의 미래 PlanDay도 충돌 평가 대상에 포함한다. 사용자가 입력한 폼 값은 저장 실패 시 유지한다.

## 10. 임시 계산 엔진

계산 로직은 후속 제공되는 정확한 수식으로 교체할 수 있도록 provisional-v1 규칙 세트로 격리한다. UI와 application use case는 계산식 내부 상수를 알지 못한다.

모든 결과에는 다음 메타데이터를 포함한다.

- algorithmVersion
- 입력 스냅샷
- 계산 시각
- 데이터 기간과 표본 수
- 누락 데이터
- confidence와 evidence

Data basis는 최소한 다음 필드를 화면과 snapshot에 제공한다.

- periodStart, periodEnd
- sampleCount와 excludedCount
- missingFields와 category별 completeness
- sourceDistribution
- computedAt과 algorithmVersion
- ConfidenceLevel과 confidence 산출 근거

### Readiness

임시 가중치는 다음과 같다.

- 수면시간 충족도: 35%
- 취침 규칙성: 25%
- 카페인 상태: 20%
- 취침 전 휴대폰 사용: 10%
- 운동·식사 상태: 10%

결과는 0부터 100 사이로 제한한다.

누락 항목을 0점으로 간주하지 않는다. 수면시간이 없으면 readiness는 insufficient이고, 그 외 일부 항목이 없으면 관측된 항목 가중치를 100%로 재정규화한다. 누락은 점수를 직접 깎는 대신 confidence와 Data basis에 반영한다.

### Confidence

- 표본 수: 40%
- 입력 완성도: 30%
- 패턴 반복성: 20%
- 데이터 출처 신뢰도: 10%

표본 점수는 `min(유효 수면일 / 14, 1)`, 완성도는 선택 기간에 기대되는 카테고리 중 실제 입력 비율로 계산한다. 현재 직접 입력의 출처 신뢰도는 provisional-v1에서 0.6으로 고정한다. 패턴 반복성은 취침·기상 시각 편차가 작을수록 높게 계산하되 상수는 규칙 설정 파일에 둔다.

임시 구간은 다음과 같다.

- 데이터 3일 미만: insufficient
- 0.35 미만: low
- 0.35 이상 0.70 미만: medium
- 0.70 이상: high

### 기타 임시 규칙

- Baseline: 최근 최대 14일 중 유효하게 완료된 SleepSession만 사용하며 3일 미만은 insufficient
- 카페인: 반감기 5시간
- Sleep Impact: 행동이 있었던 수면일과 없었던 수면일이 각각 3일 이상일 때만 평균 차이를 표시
- 주요 일정 계획: 목표 취침·기상 시각을 하루 최대 15분씩 이동
- What-if: 현재 입력에 가상 행동을 추가해 동일 엔진으로 다시 계산
- Rerouting: cutoff 초과나 목표 실패 이후의 계획만 재계산

Baseline의 표본 수는 기간 내 날짜 수가 아니라 유효한 SleepSession 수다. 누락값은 0으로 대체하지 않고 해당 계산에서 제외한다. Sleep Impact의 두 집단 중 하나라도 최소 표본을 충족하지 않으면 비교값 대신 필요한 기록 수를 표시한다.

Sleep Impact와 카페인 분석은 “영향을 주었다”가 아니라 “함께 나타난 패턴” 또는 “관찰된 신호”로 표현하며 인과관계로 단정하지 않는다. 모든 임시 결과에는 의료적 판단이 아닌 초기 추정 모델임을 표시한다.

## 11. 주요 일정과 AI 일정 조언

사용자가 Plan 화면에서 주요 일정을 직접 추가하면 SchedulePlanningUseCase가 실행된다.

입력:

- 일정 시작 시각과 종류
- 사용자의 목표 취침·기상
- 최근 Baseline
- 기존 SleepPlan과 PlanDay
- 최근 수면과 생활 기록

규칙 엔진 출력:

- 조정 시작 날짜
- 일정 당일 목표 기상 시각
- 일별 목표 취침·기상
- 카페인 cutoff
- 운동·식사 cutoff
- wind-down 시작 시각
- 기존 일정과의 충돌
- confidence와 evidence

LLM은 이 출력만 받아 사람이 이해하기 쉬운 한국어 설명을 만든다. 숫자, confidence, 일정은 LLM이 변경할 수 없다.

생성된 ScheduleAdvice는 먼저 generated 상태로 저장한다. Figma처럼 제안 카드와 “계획에 반영” CTA를 표시하며, 사용자가 승인하기 전에는 SleepPlan을 변경하지 않는다.

“계획에 반영”을 누르면 바로 변경하지 않고 ConfirmationDialog에서 변경되는 날짜 수와 날짜별 기존값 → 제안값을 보여준다. 사용자가 이 미리보기를 다시 확인한 뒤 반영하면 하나의 transaction에서 다음을 수행한다.

1. 기존 ScheduleAdvice를 accepted로 변경
2. 기존 미래 PlanDay를 superseded하고 새 active PlanDay 생성
3. PlanRevision에 변경 전후 스냅샷 저장
4. 이전 제안을 superseded 처리

데이터가 부족하면 SleepGoal과 기본 이동 규칙을 사용하고 confidence를 low로 표시한다. 생성 실패 시 기존 계획은 유지한다.

Plan과 Analyze에서 같은 ScheduleAdvice를 사용한다. Analyze의 일정 인지형 제안에서 “계획 화면에 반영”을 선택해도 동일한 use case가 실행된다.

외부 캘린더 연결은 후속 과업이다. 현재 Plan 화면의 연결 버튼은 준비 중 상태를 표시하며, 주요 일정 직접 입력과 AI 조언은 완전히 동작한다.

### Rerouting

Rerouting 평가는 다음 두 경우에 실행한다.

- 사용자가 저장한 카페인·음주·식사·운동 기록이 active PlanDay의 cutoff를 넘음
- 수면 기록의 추가·수정으로 해당 일자의 목표 수면 결과가 실패로 바뀜

평가 범위는 trigger 시각 이후의 active PlanDay뿐이다. completed 또는 superseded PlanDay와 과거 날짜는 바꾸지 않는다. 엔진은 `triggerType=reroute`인 ScheduleAdvice를 만들고 바뀌는 미래 날짜를 제시한다. 최초 일정 제안과 동일하게 사용자가 확인·승인해야 새 PlanRevision이 생성된다. 사용자가 거절하면 현재 계획을 유지하고 advice만 dismissed로 바꾼다.

재계획 제안은 Plan의 ScheduleAdviceCard에 표시하고 Today의 PreparationTimeline에는 “계획 조정 제안 있음” 요약과 Plan 이동 CTA를 표시한다. 어느 진입점에서도 자동 적용하지 않는다.

### What-if

What-if는 선택한 가상 행동을 현재 AnalysisSnapshot 입력의 복사본에만 적용해 score와 confidence 차이를 계산한다. 조회와 비교만으로는 DB에 기록, snapshot, advice를 생성하지 않는다. “실제 기록으로 추가”를 누르면 해당 입력 폼으로 값을 넘기고, 사용자가 최종 제출한 뒤에만 정상 저장·재계산 흐름을 실행한다.

## 12. LLM 내레이션

NarrationProvider 인터페이스 뒤에 서버 전용 LLM 구현을 둔다. 첫 구현은 OpenAI provider를 사용하며 API 키는 서버 환경변수로만 관리한다.

LLM 입력은 다음으로 제한한다.

- 허용 목록에 있는 metric id, 계산값, 등급
- 기간, 표본 수, 누락 수, source 분포처럼 집계된 dataBasis
- 종류와 방향, 집계 건수만 담은 evidence
- 일정 종류와 시작 시각, 규칙 엔진이 확정한 proposal
- 허용된 응답 스타일과 비의료적 표현 규칙

일정 제목·메모, 개별 원시 생활 기록, 닉네임, 이메일, 인증 정보, 원시 세션 토큰은 전송하지 않는다. 일반 애플리케이션 로그에도 prompt와 response 본문을 남기지 않는다. Narration에는 provider, model, inputHash, 검증된 output, 상태만 저장한다.

응답은 구조화 schema로 검증한다. 실패, timeout, schema 불일치 시 deterministic template을 사용한다. 화면의 숫자와 계획은 항상 규칙 엔진 결과를 직접 렌더링하고 LLM 텍스트에서 파싱하지 않는다.

## 13. 오류·빈 상태·보안

### 사용자 경험

- 로그인 실패: 필드 단위 오류
- 세션 만료: 폼 내용 보존 후 로그인 복귀
- 잘못된 시간·수량: 제출 전후 동일 schema로 검증
- 데이터 부족: 오류 대신 insufficient 상태와 필요한 기록 일수 표시
- 계산 실패: 마지막 정상 스냅샷과 재계산 CTA
- DB 실패: 입력 유지, 일반 오류 메시지, 재시도
- LLM 실패: 규칙 기반 설명
- 계획 충돌: 사용자가 승인하기 전 변경 금지
- 후속 연동: 준비 중 상태를 명시

### 보안과 개인정보

- 모든 query와 mutation에 세션 userId 범위 강제
- Better Auth의 비밀번호 해시와 세션 관리 사용
- Secure, HttpOnly, SameSite cookie 정책
- 입력값을 로그에 남기지 않음
- LLM에 최소 데이터만 전달
- 데이터 내보내기와 전체 삭제 전에 재인증과 확인
- 삭제는 사용자 소유 데이터와 인증 데이터를 통제된 transaction으로 처리
- 의료 진단 또는 인과관계로 단정하지 않는 문구

최근 인증 기준은 5분이다. 내보내기와 전체 삭제 시 마지막 인증이 5분을 넘었으면 비밀번호 재입력을 요구한다. 전체 삭제는 계정 이메일 확인과 명시적 확인 문구 입력을 추가로 요구한다.

데이터 내보내기는 버전이 있는 JSON 파일로 제공하며 다음을 포함한다.

- 프로필, 수면 목표, 습관과 연결 설정
- 사용자가 직접 입력한 모든 기록과 변경 이력
- 주요 일정, 계획, 제안과 revision
- 분석 결과와 Data basis, 케어 실행 이력

비밀번호 해시, Account credential, Verification token, Session token, LLM prompt 원문은 제외한다.

계정 전체 삭제는 hard delete다. 한 transaction에서 다른 세션을 먼저 폐기하고, Narration을 포함한 사용자 도메인 데이터, Account와 Verification, 현재 Session, User 순으로 삭제한다. 완료 즉시 현재 브라우저 세션을 무효화하고 로그인 화면으로 이동한다. 일부만 삭제된 상태가 남지 않도록 실패 시 전체 rollback한다.

## 14. 테스트 전략

### 단위 테스트

- provisional-v1 계산
- Baseline, Confidence, Readiness
- 최소 표본, 누락값, 직접 입력 source 신뢰도
- 자정을 넘는 수면, timezone 변경, DST gap·반복 시각
- What-if, 주요 일정 분석, Rerouting
- LLM 출력 schema와 fallback
- RoutineStep 파생 상태와 당일 undo

### Prisma 통합 테스트

- 직접 입력 CRUD
- 사용자별 데이터 격리
- 일정 추가 → ScheduleAdvice 생성
- 제안 승인 → PlanDay와 PlanRevision 변경
- 기록 수정·삭제 → snapshot supersede와 새 계산
- idempotency와 transaction rollback
- SQLite와 PostgreSQL 핵심 시나리오
- JSON schemaVersion, 크기 제한, relation 소유권 invariant

### Better Auth 통합 테스트

- 회원가입, 로그인, 로그아웃
- 세션 만료
- 보호 라우트
- 인증 없는 Server Action 차단
- 다른 사용자의 데이터 접근 차단
- 병렬 테스트 worker마다 고유 사용자와 세션 사용

### 컴포넌트 테스트

- EntryPresence 전체 상태
- RoutineStatus 전체 상태
- SyncMode, SyncAvailability, SyncState의 허용·금지 조합
- ConfidenceLevel 전체 상태
- 폼 오류와 제출 중 상태
- LLM fallback
- Today 영역별 ready, insufficient, stale, error 상태

### Playwright E2E

1. 회원가입 → 온보딩 → Today
2. 수면·휴대폰·식사·운동·카페인·음주 기록
3. Record Hub 상태 변경
4. 주요 일정 추가 → AI 제안 → 계획 반영
5. Analyze의 지표·근거·데이터 기준 확인
6. Care 루틴 완료와 케어 도구 실행
7. 프로필과 수면 목표 수정
8. 데이터 내보내기와 삭제 확인 절차
9. 기록 수정·삭제 → 재계산 → Rerouting 승인·거절
10. What-if 조회는 저장되지 않고 실제 추가 CTA만 기록 폼으로 연결

### Figma 시각 검증

- visual-regression manifest에 등록된 실제 런타임 프레임의 데스크톱·모바일 스크린샷 비교
- 고정 clock, localDate, timezone, seed 사용자·데이터와 동일한 폰트 로드
- animation·caret을 끄고 breakpoint, container 폭, pixel threshold를 manifest에 고정
- 키보드 탐색과 focus
- 명암 대비와 reduced motion

### 배포 검증

- PostgreSQL migration
- SQLite·PostgreSQL contract test matrix
- Vercel preview smoke test
- Better Auth base URL과 cookie
- 환경변수 누락
- LLM과 DB 장애 fallback

## 15. SQLite에서 PostgreSQL로 전환

SQLite는 로컬 기능 검증과 초기 테스트에만 사용한다. Vercel 운영 환경에서는 PostgreSQL을 사용한다.

1. provider가 sqlite인 Prisma schema로 로컬 기능 검증
2. 기능 개발 초기부터 CI가 같은 canonical data model로 임시 PostgreSQL schema를 생성해 핵심 repository contract test 실행
3. SQLite 전체 E2E 완료
4. provider를 postgresql로 전환하고 canonical model diff에 datasource 외 변경이 없는지 확인
5. SQLite migration을 재사용하지 않고 PostgreSQL 초기 migration 생성·검토
6. seed 데이터를 PostgreSQL에 재생성
7. PostgreSQL 통합·E2E 재실행
8. Vercel preview 배포와 인증·DB·LLM smoke test
9. production migration 후 배포

로컬 프로토타입 데이터는 운영 DB로 이관하지 않는다. 따라서 데이터 변환 migration은 이번 범위에 포함하지 않는다.

호환성 contract는 두 provider에서 같은 seed와 use case를 실행해 결과 JSON, 정렬, unique 제약, cascade, transaction rollback이 동일한지 검증한다. 테스트용 PostgreSQL schema는 canonical model에서 datasource만 바꿔 생성하며 수작업으로 별도 모델을 유지하지 않는다. provider별 raw SQL과 암묵적인 대소문자·null 정렬 동작은 사용하지 않는다.

첫 production 배포에는 이전 사용자 데이터가 없으므로 seed 재생성만 수행한다. 이후 운영 migration은 DB snapshot 또는 공급자 백업 확인 → expand migration → 호환 애플리케이션 배포 → contract migration 순서로 진행한다. 실패 시 직전 애플리케이션 버전으로 되돌리고 destructive rollback 대신 보정 migration을 적용한다.

필수 운영 환경변수:

- DATABASE_URL
- BETTER_AUTH_SECRET
- BETTER_AUTH_URL
- OPENAI_API_KEY
- OPENAI_MODEL

## 16. 고수준 구현 순서

1. Next.js, TypeScript, 디자인 토큰, Prisma SQLite 기반
2. Better Auth와 보호 route group
3. 온보딩과 사용자 설정
4. 직접 입력과 Record Hub
5. provisional-v1 엔진과 Today
6. 주요 일정, SleepPlan, ScheduleAdvice, Rerouting
7. Analyze와 LLM 내레이션
8. Care와 Account
9. 전체 모바일 반응형 조정
10. PostgreSQL 전환
11. 전체 테스트, Figma 시각 검증, Vercel 배포

## 17. 완료 기준

- Figma의 모든 활성 화면이 대응 라우트 또는 공통 컴포넌트로 구현된다.
- 데스크톱과 모바일 화면이 동일한 사용자 데이터로 동작한다.
- 사용자가 계정을 만들고 온보딩을 완료할 수 있다.
- 모든 생활 기록을 직접 추가·수정·삭제할 수 있다.
- Today, Record, Plan, Analyze, Care, Account가 실제 저장 데이터로 연결된다.
- 주요 일정 추가 후 규칙 기반 제안과 LLM 설명이 표시된다.
- 사용자가 변경 날짜와 전후 값을 확인하고 승인한 경우에만 계획이 변경된다.
- 기록 수정·삭제와 cutoff 이탈은 과거 계획을 덮어쓰지 않고 승인 가능한 Rerouting 제안을 만든다.
- 데이터가 부족하거나 LLM이 실패해도 전체 흐름이 중단되지 않는다.
- 다른 사용자의 데이터에 접근할 수 없다.
- 실제 자동 연동이 없는 상태를 “연동됨” 또는 “자동 입력”으로 오인시키지 않는다.
- 계정 데이터 내보내기와 재인증을 거친 전체 삭제가 동작한다.
- provisional-v1은 후속 수식 버전으로 UI 변경 없이 교체 가능하다.
- PostgreSQL 환경의 전체 테스트가 통과한다.
- Vercel production에서 인증, 기록, 분석, 계획 흐름이 동작한다.
