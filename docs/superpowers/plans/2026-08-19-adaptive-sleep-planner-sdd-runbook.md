# Adaptive Sleep Planner SDD 실행 운영서

> **현재 상태:** 문서 준비만 완료했다. 애플리케이션 코드, 테스트 코드, 의존성 설치, 데이터베이스 생성·마이그레이션, Figma 구현, Vercel 배포는 모두 시작하지 않았다.
>
> **시작 조건:** 사용자가 별도로 “구현을 시작해”라고 명시하기 전까지 이 문서는 실행하지 않는다.

## 1. 목적

이 문서는 아래 상세 구현 계획을 **1번 방식인 Subagent-Driven Development(SDD)** 로 실행할 때 사용할 운영 기준이다.

- 설계 기준: `docs/superpowers/specs/2026-08-19-adaptive-sleep-planner-design.md`
- 상세 구현 계획: `docs/superpowers/plans/2026-08-19-adaptive-sleep-planner.md`
- 구현 대상: 상세 구현 계획의 Task 1~22 전체
- UI 기준: Figma의 활성 런타임 frame
- 기획 참고: Notion

이 문서는 상세 구현 계획을 대체하거나 Task 내용을 중복 정의하지 않는다. **무엇을 구현하는지는 상세 구현 계획**, **어떻게 안전하게 실행하고 검토하는지는 이 운영서**가 담당한다.

사용자가 실행 시작 신호를 주면 controller는 현재 세션에서 반드시 `superpowers:subagent-driven-development` 스킬로 상세 계획을 실행한다. **1번 방식에는 수동 실행이나 `superpowers:executing-plans`를 대신 사용하지 않는다.**

문서 간 우선순위는 다음과 같다.

1. 사용자가 가장 최근에 확정한 지시
2. 구현 설계서
3. 상세 구현 계획
4. 이 실행 운영서
5. 실행 중 에이전트의 판단

상충하는 내용이 발견되면 상위 문서를 기준으로 결정하고 진행 원장에 `Ruling:`으로 기록한다.

## 2. 현재 구현 상태

| 구분 | 상태 | 의미 |
|---|---|---|
| 구현 설계서 | 작성 완료 | 범위와 제품·기술 결정을 확정한 문서 |
| 상세 구현 계획 | 작성 완료 | 22개 Task와 테스트·파일·커밋 단위를 정의한 문서 |
| SDD 실행 운영서 | 작성 완료 | 향후 1번 방식 실행 절차를 정의한 현재 문서 |
| Task 1~22 | 전부 미착수 | 소스, 테스트, DB, UI, 배포 작업을 시작하지 않음 |
| SQLite 검증 | 미착수 | 로컬 개발용 DB도 아직 만들지 않음 |
| PostgreSQL 전환 | 미착수 | Task 22에서 수행할 후반 작업 |
| Vercel 배포 | 미착수 | Task 22 검증과 별도 승인 이후 수행할 외부 작업 |

상세 계획의 단계·Task·체크박스는 **완료 기록이 아니라 앞으로 실행할 목록**이다.

## 3. 구현 시작 전 경계

### 시작 전 허용하는 작업

- 설계서, 상세 구현 계획, 이 운영서의 검토와 문서 수정
- 원격 저장소, 실행 환경, 필요한 계정·환경 변수의 준비 상태 확인
- 실행 시 사용할 브랜치명과 worktree 위치의 사전 확인
- 계획의 충돌이나 누락을 찾는 읽기 전용 점검

### 시작 전 금지하는 작업

- `package.json`, `src/`, `tests/`, `prisma/` 등 애플리케이션 파일 생성·수정
- 패키지 설치와 lockfile 생성
- Prisma 스키마 생성, 마이그레이션, seed 실행
- Better Auth, OpenAI, PostgreSQL, Vercel 설정 변경
- Figma 화면을 코드로 구현하거나 Figma 파일을 수정하는 작업
- 테스트·빌드·배포를 위한 구현성 변경
- 구현 브랜치나 구현용 worktree 생성

### 실행 시작 신호

사용자가 “상세 계획을 1번 방식으로 구현 시작해”와 같이 명시적으로 요청하면 실행을 시작한다. 그 전에는 Task 1도 착수하지 않는다.

## 4. 실행 원칙

SDD 실행의 핵심은 다음 네 가지다.

1. **Task별 새 구현자:** 각 Task는 해당 Task만 전달받은 새 implementer가 담당한다.
2. **Task별 독립 검토:** 구현자와 다른 reviewer가 명세 준수와 코드 품질을 각각 판정한다.
3. **진행 원장 유지:** 완료 Task, 커밋, 수정 라운드, 판단을 파일에 기록해 컨텍스트 손실 후에도 중복 실행을 방지한다.
4. **최종 전체 검토:** 22개 Task가 끝난 뒤 브랜치 전체 diff를 별도 reviewer가 다시 검토한다.

구현 Task를 동시에 여러 implementer에게 맡기지 않는다. 동일 파일과 인터페이스가 이어지는 계획이므로 Task 1부터 Task 22까지 순차 실행한다. 읽기 전용 조사나 검토 준비만 충돌이 없을 때 병렬화할 수 있다.

## 5. 역할과 책임

| 역할 | 책임 | 금지 사항 |
|---|---|---|
| Controller | 계획 순서 관리, brief 작성, 진행 원장 기록, reviewer 배정, 충돌 판정 | 직접 애플리케이션 코드를 고쳐 검토 절차를 우회하지 않음 |
| Implementer | 한 Task의 실패 테스트, 최소 구현, 회귀 검증, 커밋, 자기 검토, 보고서 작성 | 다른 Task 선행 구현, 하위 에이전트 생성, 자체 reviewer 배정 금지 |
| Task Reviewer | Task 요구사항 대비 명세 준수와 품질을 독립 판정 | 구현자의 요약만 믿고 diff를 생략하지 않음 |
| Fix Implementer | reviewer가 확인한 중요 이슈를 수정하고 관련 테스트를 재실행 | 검토 범위 밖 기능 추가 금지 |
| Final Reviewer | 전체 브랜치의 통합 정합성, 보안, 회귀, 설계 준수를 최종 검토 | Task별 검토를 단순 반복하는 데 그치지 않음 |

## 6. 작업공간과 브랜치 정책

실행이 시작되면 `superpowers:using-git-worktrees` 절차로 격리된 작업공간을 먼저 만든다.

- 기준 브랜치: 사용자가 지정한 기본 브랜치. 별도 지정이 없으면 `main`
- 구현 브랜치 기본 이름: `codex/adaptive-sleep-planner`
- 원칙: `main` 또는 `master`에서 직접 구현하지 않는다.
- 계획 파일: `docs/superpowers/plans/2026-08-19-adaptive-sleep-planner.md`
- SDD 작업 디렉터리: `.superpowers/sdd/2026-08-19-adaptive-sleep-planner/`
- 작업 산출물: ledger, Task brief, implementer report, review package

SDD 작업 디렉터리는 실행 보조용이며 애플리케이션 산출물이 아니다. 최종 검토가 끝나기 전까지 유지하고, 복구가 필요할 때 Git 기록과 함께 사용한다.

## 7. 실행 전 점검

Task 1을 배정하기 전에 controller가 설계서와 상세 계획을 한 번씩 읽고 **전수 사전 점검 결과**를 진행 원장에 표로 남긴다. “전체적으로 이상 없음” 같은 단일 결론은 점검으로 인정하지 않는다.

진행 원장에는 먼저 Task 1~22 각각에 대한 22개 이상의 자체 정합성 행이 있어야 한다.

| Task | 파일 정의 정합성 | 테스트와 구현 단계 정합성 | 생산·소비 인터페이스 정합성 | 발견 사항 또는 Ruling |
|---:|---|---|---|---|
| 1~22의 각 Task | 계획에 생성·수정·검토 파일이 서로 맞는지 | 실패 조건, 최소 구현, 통과 조건이 서로 맞는지 | 이 Task 안에서 소비·생산 계약의 이름과 타입이 맞는지 | 없음 또는 구체적 결정 |

그다음 같은 파일이나 같은 인터페이스를 공유하는 **모든 producer/consumer Task 쌍마다 한 행씩** 기록한다. 아래 형식의 행 수는 실제 공유 관계 수에 따라 늘어난다.

| 생산 Task | 소비 Task | 공유 파일 또는 인터페이스 | 생산값과 소비값 비교 | 발견 사항 또는 Ruling |
|---:|---:|---|---|---|
| N | M | 정확한 경로, 타입, 함수, schema 또는 route | 이름, 타입, 책임, 테스트 연결이 일치하는지 | 없음 또는 구체적 결정 |

두 전수 표에서 다음을 확인한다.

- 모든 Task의 내부 단계가 해당 Task의 파일·테스트·인터페이스와 일치하는지
- 같은 파일이나 계약을 공유하는 Task 사이의 생산·소비 관계가 맞는지
- 후속 Task가 선행 Task에 정의되지 않은 타입·함수·필드를 기대하지 않는지
- Figma 활성 런타임 frame과 제외 대상이 혼동되지 않았는지
- SQLite 단계와 PostgreSQL 전환 단계가 섞이지 않았는지
- Better Auth 사용자 격리와 `UserScope` 강제가 모든 저장 경로에 유지되는지
- 확정 계산과 OpenAI 설명의 책임이 뒤바뀌지 않는지

특히 다음 연결부는 누락하기 쉬운 **고위험 예시**이므로 전수 표에 반드시 포함한다. 이 표만 작성하고 전수 점검을 생략해서는 안 된다.

| 생산 Task | 소비 Task | 점검할 계약 |
|---:|---:|---|
| 1 | 2~22 | 프로젝트 스크립트, 경로 alias, 공통 타입 |
| 3 | 4~5, 7~22 | Prisma·Better Auth 스키마와 서버 session |
| 6 | 7~9 | 시간, JSON envelope, 직접 입력 계약 |
| 7 | 8~11 | 사용자 범위 저장소, revision, idempotency |
| 10 | 11, 16~17 | `provisional-v1` 계산 결과와 evidence |
| 12 | 13~15 | 계획 도메인, 주요 일정, rerouting 계약 |
| 13~15 | 16~17 | 승인된 plan과 What-if의 영속성 경계 |
| 17 | 18~22 | 결정값을 변경하지 않는 LLM narration |
| 21 | 22 | Figma fidelity·접근성 검증과 release gate |

충돌을 발견하면 추측으로 숨기지 않고 다음 형식으로 기록한다.

`Ruling: <결정> — <설계서와 계획에 따른 이유> — <잘못됐을 때의 재작업 비용>`

## 8. 구현 마일스톤

마일스톤은 Task 순서를 바꾸기 위한 묶음이 아니라 진행 상황을 설명하기 위한 묶음이다.

| 마일스톤 | Task | 결과 | 상태 |
|---|---:|---|---|
| M0 문서 준비 | 해당 없음 | 설계서, 상세 계획, SDD 운영서 | 완료 |
| M1 기반·인증 | 1~5 | Next.js 기반, 디자인 토큰, Prisma/Better Auth, 인증, 온보딩 | 미착수 |
| M2 기록·분석 기반 | 6~11 | 직접 입력 계약, 저장, Record, 임시 계산, Today | 미착수 |
| M3 계획·AI 설명 | 12~17 | Plan, 주요 일정 조언, 승인, rerouting, Analyze, OpenAI narration | 미착수 |
| M4 Care·계정 | 18~20 | Care 도구, Account, export, 계정 삭제 | 미착수 |
| M5 완성도·배포 | 21~22 | Figma 반응형·접근성, PostgreSQL 전환, Vercel 검증 | 미착수 |

## 9. Task 실행 절차

각 Task는 아래 순서를 반드시 따른다.

1. 현재 `HEAD`를 Task의 `BASE`로 기록한다.
2. 상세 계획에서 해당 Task 전체만 추출한 Task brief를 만든다.
3. 선행 Task가 만든 인터페이스와 controller의 `Ruling:`만 brief에 보충한다.
4. 새 implementer에게 brief와 report 경로를 전달한다.
5. implementer는 상세 계획에 적힌 순서대로 실패 테스트 → 최소 구현 → 통과 확인 → 관련 회귀 검증 → 커밋을 수행한다.
6. implementer는 상태, 커밋, 테스트 명령과 결과, 우려사항을 report에 남긴다.
7. controller는 반드시 `BASE..HEAD` 전체 범위로 review package를 만든다.
8. 별도 Task reviewer가 명세 준수와 Task 품질을 모두 판정한다.
9. 중요 이슈가 있으면 수정 루프를 수행하고 scoped re-review를 받는다.
10. 모든 중요 이슈가 해소된 뒤 진행 원장에 Task 완료를 기록한다.
11. 다음 Task로 이동한다.

Task 사이에 “계속할까요?”라고 묻지 않는다. 사용자가 전체 실행을 시작하면 아래 중단 조건이 발생하거나 Task 22가 끝날 때까지 순차 진행한다.

## 10. Task 산출물 계약

### Task brief

각 brief에는 다음만 포함한다.

- 상세 계획에 적힌 해당 Task의 전체 요구사항
- 프로젝트 전체에서 이 Task가 맡는 역할 한 줄
- 앞선 Task에서 이미 확정된 소비 인터페이스
- 실행 전 점검에서 나온 관련 `Ruling:`
- implementer report 경로와 보고 형식

전체 계획이나 이전 Task의 긴 요약을 반복 전달하지 않는다.

### Implementer report

report의 상태는 다음 네 가지 중 하나다.

- `DONE`: 구현, 테스트, 커밋, 자기 검토 완료
- `DONE_WITH_CONCERNS`: 완료했지만 controller가 검토 전 확인할 우려가 있음
- `NEEDS_CONTEXT`: 필요한 선행 계약이나 결정이 빠짐
- `BLOCKED`: 현재 brief와 역량으로 완료할 수 없음

report에는 다음 증거가 있어야 한다.

- 변경 목적과 결과
- 생성한 커밋 목록
- 실행한 테스트 명령
- 테스트 결과 요약
- 자기 검토에서 발견하고 바로잡은 내용
- 남아 있는 우려나 범위 밖 관찰

### Review package

review package는 기억이나 마지막 커밋 한 개가 아니라 Task 시작 전 `BASE`부터 현재 `HEAD`까지 포함한다.

- 커밋 목록
- diff 통계
- 충분한 문맥을 포함한 전체 diff
- 동일한 Task brief와 implementer report의 경로

## 11. Task 검토 기준

Task reviewer는 반드시 두 개의 독립 판정을 제공한다.

1. **Spec compliance:** 설계서와 해당 Task 요구사항을 빠짐없이 충족하는가
2. **Task quality:** 테스트, 구조, 보안, 회귀 위험, 유지보수성이 승인 가능한가

둘 중 하나라도 빠지거나 실패하면 Task를 완료 처리하지 않는다.

### 프로젝트 고정 검토 항목

- Figma의 활성 런타임 frame만 구현하고 Archive / Earlier MVP drafts는 제외했는가
- Figma를 UI source of truth로, Notion을 기획 참고로 사용했는가
- 데스크톱과 모바일이 같은 route와 ViewModel을 공유하는가
- 지금 범위의 실제 데이터 입력은 전부 직접 입력인가
- “연동됨”, “자동 입력”처럼 실제 지원으로 오해할 카피가 활성화되지 않았는가
- 주요 일정과 rerouting이 변경 전후를 보여주고 사용자 승인 전에는 plan을 바꾸지 않는가
- What-if가 저장 plan을 변경하지 않는가
- `provisional-v1` 순수 함수가 수치와 계획을 결정하고 LLM은 설명만 하는가
- repository가 서버 session에서 만든 `UserScope` 없이 사용자 데이터를 읽거나 쓰지 못하는가
- UTC instant, IANA timezone, localDate 규칙이 유지되는가
- versioned JSON과 64 KiB 제한이 유지되는가
- 로그에 직접 입력값, 인증 정보, LLM prompt/response 본문이 남지 않는가
- `/sign-up`은 기능 검증 대상이지만 Figma visual baseline 대상에서는 제외했는가

reviewer가 `diff만으로 검증할 수 없음`을 남기면 controller가 관련 선행 결과를 직접 확인한다. 실제 누락이면 수정 루프에 넣고, 충족됨을 확인한 경우에만 완료한다.

## 12. 수정 루프

다음 항목은 수정 루프에 들어간다.

- Spec compliance 실패
- Critical 또는 Important 품질 이슈
- controller가 실제 누락으로 확인한 검증 불가 항목

Minor 이슈는 진행 원장에 `minor (deferred)`로 기록하고 Task 수정 루프에는 넣지 않는다. 최종 reviewer가 병합 전 우선순위를 다시 판정한다.

수정 루프는 Task당 최대 5회다.

| 라운드 | 담당 | 절차 |
|---:|---|---|
| 1~3 | 원래 implementer | 발견 사항 원문 전달 → 수정 → 관련 테스트 재실행 → report 추가 → scoped re-review |
| 4~5 | 더 강한 모델의 새 implementer | 기존 brief·report·열린 발견 사항 확인 → 수정 → 테스트 → scoped re-review |

매 라운드마다 다음을 진행 원장에 기록한다.

- 라운드 번호
- 해결된 발견 사항 수
- 남은 발견 사항과 한 줄 요약
- 수정 커밋 범위
- 재실행한 테스트 증거

5회 후에도 남은 이슈는 더 반복하지 않는다. Controller가 각 이슈를 판정해 다음 중 하나로 기록한다.

- `parked`: 실제이지만 후속 Task의 기반을 막지 않아 최종 검토로 넘김
- `Ruling:`: reviewer 판단과 계획이 충돌하거나 후속 작업을 위해 명시적 결정을 내려야 함

후속 Task가 의존하는 구조적 실패가 남고 가능한 경로가 모두 추측이라면 실행을 중단하고 사용자에게 알린다.

## 13. 진행 원장과 복구

진행 원장의 첫 줄은 정확히 다음 형식을 사용한다.

`# SDD ledger — plan: docs/superpowers/plans/2026-08-19-adaptive-sleep-planner.md`

최소 기록 항목은 다음과 같다.

- 실행 전 점검 표와 모든 `Ruling:`
- 각 Task의 `BASE`, `HEAD`, 커밋 범위
- implementer와 reviewer 식별자
- 수정 라운드별 결과
- deferred minor와 parked finding
- Task 완료 라인
- 마일스톤 상태

Task 완료 라인은 다음 의미를 갖는다.

- `Task N: complete (..., review clean)`: 중요 이슈 없이 검토 통과
- `Task N: complete (..., K parked)`: 5회 수정 제한 후 K개를 근거와 함께 유보

컨텍스트가 축약되거나 실행이 재개되면 대화 기억보다 진행 원장과 `git log`를 우선한다. 이미 완료 라인이 있는 Task를 다시 배정하지 않는다.

## 14. 커밋과 원격 반영 정책

- 각 Task는 상세 계획에 정의된 독립 검증 단위로 커밋한다.
- 한 Task에 여러 커밋이 생길 수 있지만 검토 범위는 항상 `BASE..HEAD` 전체다.
- reviewer가 본 커밋을 임의로 amend하거나 rebase해 검토 증거를 바꾸지 않는다.
- controller는 reviewer 지적을 직접 고쳐 넣지 않고 담당 implementer와 re-review 절차를 거친다.
- 문서 커밋과 구현 커밋을 섞지 않는다.
- 공유 원격으로의 push, 기본 브랜치 merge, preview 공개, production 배포는 외부 side effect이므로 사용자 승인 범위를 확인한 뒤 수행한다.
- 원격 저장소가 설정되지 않은 경우 URL과 대상 브랜치를 추측해서 만들지 않는다.

## 15. 사용자에게 보이는 체크포인트

전체 구현 시작 후에는 Task 사이 승인을 반복해서 요청하지 않되, 아래 시점에 간단한 진행 상황과 검증 결과를 알린다.

| 시점 | 알릴 내용 | 진행 여부 |
|---|---|---|
| 실행 시작 직전 | worktree, 브랜치, 미충족 환경 조건 | 시작 조건이 충족되면 계속 |
| Task 3 완료 | Prisma·Better Auth 기반과 SQLite schema 검증 | 보고 후 계속 |
| Task 11 완료 | 직접 입력 → 분석 → Today 핵심 흐름 | 보고 후 계속 |
| Task 18 완료 | Plan·Analyze·Care 포함 주요 사용자 흐름 | 보고 후 계속 |
| Task 21 완료 | 전체 Figma 화면, 반응형, 접근성 결과 | 보고 후 계속 |
| Task 22 preview 직전 | PostgreSQL migration과 배포 전 검증 결과 | 외부 배포 승인이 없으면 중단 |
| production 전환 직전 | backup, migration 순서, smoke 결과 | 명시적 승인 후 진행 |

다음 네 경우에는 자동으로 결정하지 않고 중단한다.

1. 되돌리기 어려운 파괴적 작업
2. 새 자격증명 취급이나 보안 경계 변경이 필요한 작업
3. 승인 범위를 벗어난 push, merge, publish, deployment
4. 설계서와 계획이 모두 답을 주지 못해 모든 경로가 추측인 경우

## 16. Figma 구현 운영 규칙

Figma 관련 Task를 시작할 때는 `figma:figma-design-to-code` 지침을 먼저 적용한다.

- 페이지별 design context와 screenshot을 함께 확인한다.
- 기존 프로젝트 디자인 토큰과 공통 컴포넌트를 우선 재사용한다.
- Foundations의 색상, 타이포, 간격, radius를 먼저 고정한다.
- 화면별 구현 후 계획에 정의된 desktop/mobile viewport에서 비교한다.
- visual manifest의 모든 활성 runtime frame을 검증한다.
- Cover, Foundations, Components, Product Flow는 구현 근거로 사용하되 runtime screenshot 목록과 혼동하지 않는다.
- Archive / Earlier MVP drafts는 구현하지 않는다.
- 모바일 네이티브 앱과 별도 모바일 route를 만들지 않는다.

## 17. SQLite·PostgreSQL·Vercel 게이트

### SQLite 중심 로컬 실행

Task 3부터 Task 21까지 애플리케이션의 주 로컬 runtime provider는 SQLite다. 이 단계에서 PostgreSQL 전용 동작을 애플리케이션 계층에 섞지 않는다.

### PostgreSQL 계약 검증

PostgreSQL 검증을 Task 22까지 미루지 않는다. Task 7에서 named volume이 없는 disposable PostgreSQL 서비스를 만들고 최초 repository contract를 검증한다. 이후 Prisma schema를 변경하는 모든 Task는 커밋 전에 같은 PostgreSQL contract를 다시 실행한다.

- Task 7: SQLite 저장 동작과 disposable PostgreSQL의 user isolation, composite unique, versioned JSON round trip, cascade, rollback 계약을 최초 확립
- Task 8~21 중 schema 변경 Task: 해당 Task의 테스트와 함께 PostgreSQL database contract 재실행
- Task 22: 이미 유지해 온 provider contract를 바탕으로 canonical provider 전환과 release 검증 수행

### PostgreSQL canonical 전환

Task 22에서는 다음을 별도 release gate로 검증한다.

- SQLite와 PostgreSQL repository contract의 동일 동작
- canonical Prisma provider와 migration history 전환
- Better Auth schema drift 부재
- 명시적 constraint와 migration 검증
- PostgreSQL CI에서 unit, integration, component, E2E, visual, build 통과

Task 22는 migration 디렉터리와 canonical provider를 바꾸고 CI·브라우저 parity와 Vercel release gate를 완성하는 저장소 전체 변경이다. 반드시 격리된 구현 브랜치에서 수행한다.

### Vercel 배포 단계

상세 계획의 **Task 22 Step 6~7이 이 절의 권위 있는 전체 체크리스트**다. 아래 항목을 모두 포함해 preview 배포를 검증한다.

- lint
- typecheck
- unit·integration·component 테스트
- SQLite·PostgreSQL contract 테스트
- E2E와 visual regression
- production build
- Better Auth exact origin과 환경 변수 확인
- migration 검증
- `vercel pull`과 preview 환경 변수 pull
- preview DB를 대상으로 한 `prisma migrate deploy`
- `vercel build`
- `scripts/deploy-preview.mjs`가 반환받은 정확한 HTTPS `.vercel.app` URL에 대한 smoke test
- `/sign-in`과 인증 route의 여섯 보안 헤더 검증
- UUID 범위의 smoke account 생성부터 제품 확인 흐름을 통한 `finally` 정리까지의 전체 journey

preview smoke가 통과한 뒤에만 production 승인을 요청한다. Production migration은 backup 또는 복구 지점을 확인하고, 호환 가능한 배포 순서를 사용한다. 실패 시 기존 migration을 파괴적으로 되돌리지 않고 forward corrective migration을 우선한다.

## 18. 최종 전체 검토

Task 22까지 완료되면 시작 브랜치와 현재 `HEAD`의 merge-base를 기준으로 전체 review package를 만든다. 가장 높은 판단 역량의 별도 reviewer가 다음을 검토한다.

- 22개 Task와 설계서의 전체 충족 여부
- Task 사이 인터페이스 정합성
- 사용자 데이터 격리와 인증 보안
- 계산 엔진과 LLM 책임 분리
- 주요 일정·rerouting 승인 경계
- 반응형 Figma fidelity와 접근성
- SQLite/PostgreSQL 동등성과 배포 안전성
- 진행 원장에 남은 deferred minor, parked finding, 모든 `Ruling:`

최종 발견 사항이 있으면 전체 목록을 한 명의 fix implementer에게 한 번만 전달한다. 수정 후 scoped re-review를 한 번 수행하며, 남은 항목은 근거와 비용을 명시해 사용자에게 인계한다.

## 19. 완료 기준과 인계

다음 조건을 모두 충족해야 구현 완료라고 말할 수 있다.

- Task 1~22가 진행 원장에 완료로 기록됨
- 각 Task가 spec compliance와 Task quality 검토를 통과함
- 최종 전체 브랜치 검토가 끝남
- 상세 계획의 Final Verification Checklist가 실제 명령 결과로 충족됨
- Figma 활성 런타임 화면의 desktop/mobile 구현과 visual 검증이 완료됨
- Better Auth 사용자 격리와 개인정보 동작이 검증됨
- SQLite 로컬 검증과 PostgreSQL CI·preview 검증이 모두 통과함
- 중요한 미해결 finding이 없거나 사용자에게 명시적으로 인계됨

최종 보고에는 다음을 포함한다.

- 구현된 범위와 검증 결과
- 최종 브랜치와 커밋 범위
- 진행 원장의 모든 `Ruling:`을 발생 순서대로 정리한 목록
- deferred·parked 항목과 잘못 판단했을 때의 비용
- preview와 production 상태
- 병합·배포를 위해 사용자에게 남은 선택지

최종 전체 검토가 끝나기 전에는 SDD 작업 디렉터리를 정리하지 않는다. 완료 후에는 `superpowers:finishing-a-development-branch` 절차로 병합, PR, 브랜치 유지 여부를 결정한다.

## 20. 이 문서 작성 직후의 다음 상태

이 운영서를 커밋해도 구현은 시작된 것이 아니다. 다음 상태가 유지된다.

- Task 1~22: 전부 미착수
- 애플리케이션 코드: 없음
- 테스트 실행: 없음
- SQLite/PostgreSQL DB: 없음
- Vercel 배포: 없음

다음 구현 작업은 사용자의 별도 시작 지시가 있을 때 Task 1부터 시작한다.
