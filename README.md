# Sleep Loop

Sleep Loop는 수면 기록과 생활 습관을 바탕으로 오늘 밤의 준비와 다음 수면 계획을 제안하는 Adaptive Sleep Planner입니다. 사용자가 직접 입력한 데이터를 중심으로 수면 준비도, 분석 근거, 루틴을 한 흐름에서 확인할 수 있도록 설계했습니다.

## 해결하려는 문제

수면에 영향을 주는 카페인, 음주, 식사, 운동, 휴대폰 사용과 수면 시간을 여러 곳에 따로 기록하면 오늘 무엇을 바꿔야 하는지 판단하기 어렵습니다. Sleep Loop는 기록을 사용자별로 저장하고, 시간대와 수면 목표를 기준으로 오늘의 상태를 계산해 실행 가능한 다음 행동으로 연결합니다.

## 주요 사용자 흐름

1. `/` 접속 시 세션이 없으면 로그인 화면으로 이동합니다.
2. 새 사용자는 회원가입 후 Basic profile → Habits → Sleep goal → Connect 온보딩을 완료합니다. 각 단계의 입력은 사용자 계정에 저장되며, 완료 후 Today로 이동합니다.
3. 기존 사용자는 로그인 후 `/today`에서 오늘의 준비도와 기록 상태를 확인합니다.
4. `/record`에서 수면·카페인·음주·식사·운동·휴대폰 사용·주관적 컨디션을 추가·수정·삭제합니다.
5. `/plan`에서 수면 목표와 주요 일정을 확인하고, 일정 변경에 따른 조정 제안을 반영합니다.
6. `/analyze`에서 지표·추세·영향 요인·데이터 근거와 AI 설명 리포트를 확인합니다.
7. `/care`에서 오늘 밤 루틴과 호흡·백색소음·수면 가이드 도구를 실행합니다.
8. `/account`에서 프로필·수면 목표·연결 상태를 관리하고 데이터 내보내기·삭제를 요청할 수 있습니다.

## 구현 기능

- 이메일·비밀번호 인증, 세션 기반 보호 라우트, 사용자별 데이터 소유권 검증
- 중단 후에도 이어지는 4단계 온보딩과 IANA 시간대 기반 날짜·시간 처리
- 직접 입력 기록의 생성·수정·삭제, 중복 요청 방지용 mutation receipt, 기록 변경에 따른 분석 재계산
- Today의 Readiness, Confidence, 당일 데이터 상태, 기록 요약, 준비 타임라인
- 2주 수면 계획, 주요 일정, What-if 미리보기, 일정 조정 제안과 반영 이력
- 카페인 프로필·수면 추세·영향 요인·설명 가능성·데이터 기준을 포함한 Analyze 화면
- 규칙 엔진 결과를 기준으로 하는 OpenAI 분석 내레이션
- Care 루틴 상태 관리, 호흡 가이드·백색소음·수면 가이드 세션 기록
- Account의 프로필·목표 수정, 데이터 export와 계정 삭제 경계
- 데스크톱 사이드바와 모바일 하단 내비게이션을 사용하는 반응형 AppShell

## 기술 스택

- Next.js 16 App Router, React 19, TypeScript strict mode
- Prisma 7, PostgreSQL runtime, SQLite local/contract test, 명시적 driver adapter
- Better Auth 1.7, Zod, Temporal polyfill
- Vitest, Testing Library, Playwright, axe-core
- CSS Modules 및 공통 디자인 토큰
- OpenAI API: 서버 전용 분석 내레이션 provider
- 패키지 관리자: npm (`package-lock.json`을 단일 lockfile로 사용)

## 아키텍처

애플리케이션은 Next.js App Router 기반 모듈형 모놀리스이며, 다음 의존 방향을 유지합니다.

```text
UI → application use case → domain rule → repository interface → Prisma
```

UI는 Figma 기반 화면과 사용자 입력을 담당하고, application 계층은 세션·검증·transaction 경계를 조정합니다. domain 계층은 준비도·분석·계획·Care 계산을 순수 규칙으로 제공하며, repository 계층이 사용자 범위의 저장·조회 계약을 Prisma와 연결합니다. 인증은 Better Auth, AI 설명은 서버 전용 OpenAI provider가 담당합니다.

기능 모듈은 `auth`, `onboarding`, `records`, `baseline`, `analysis`, `planner`, `narration`, `care`, `account`로 나뉘어 각 사용자 행동과 데이터 경계를 분리합니다.

## 로컬 실행

Node.js `>=22.13 <25`와 npm이 필요합니다.

```bash
npm ci
cp .env.example .env
# .env에 아래 환경 변수의 실제 개발용 값을 입력
npm exec -- prisma generate
npm run dev
```

필수 runtime 환경 변수 이름은 다음과 같습니다. 실제 값과 비밀키는 저장소에 커밋하지 않습니다.

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
AUTH_RATE_LIMIT_ENABLED
OPENAI_API_KEY
OPENAI_MODEL
```

## 품질 검증

주요 로컬 게이트는 다음 명령으로 실행합니다.

```bash
npm run lint
npm run typecheck
npm run test:run
npm run verify:auth-schema
npm run build
```

각 명령은 저장소의 unit, component, integration, schema, build 품질 게이트를 실행합니다.

## 저장소 구조

```text
src/app/                 App Router 페이지, Server Action, API route
src/modules/             auth/onboarding/records/analysis/planner/care/account 모듈
src/shared/               인증, DB, 시간, 공통 UI와 설정
prisma/                  canonical schema와 데이터 모델
tests/                   unit, component, integration, E2E, accessibility 테스트
scripts/                 schema 준비, fixture와 개발·테스트 helper
docs/                    제품 명세, 구현 계획, 운영 문서
.github/workflows/       CI와 quality workflow
```
