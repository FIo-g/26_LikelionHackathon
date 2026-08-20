import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.BASE_URL;
const smokeOrigin = baseUrl ? new URL(baseUrl) : null;
const describePreview = smokeOrigin?.protocol === "https:" && smokeOrigin.hostname.endsWith(".vercel.app")
  ? test.describe
  : test.describe.skip;
const email = `smoke-${crypto.randomUUID()}@example.invalid`;
const password = "Smoke-passphrase-2026";
let accountMayExist = false;

const futureEventLocalDateTime = (daysFromNow: number): string => {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueFor = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  const year = valueFor("year");
  const month = valueFor("month");
  const day = valueFor("day");

  if (!year || !month || !day) throw new Error("SMOKE_EVENT_DATE_FORMAT_FAILED");
  return `${year}-${month}-${day}T09:00`;
};

describePreview("deployed preview smoke", () => {
  test.afterEach(async ({ browser }) => {
    if (!accountMayExist || !smokeOrigin) return;
    const cleanupContext = await browser.newContext({ baseURL: smokeOrigin.origin });
    try {
      const cleanupPage = await cleanupContext.newPage();
      const signIn = await cleanupPage.request.post("/api/auth/sign-in/email", {
        data: { email, password },
        headers: { origin: smokeOrigin.origin },
      });
      expect(signIn.ok()).toBe(true);
      await cleanupPage.goto("/account");
      await cleanupPage.getByRole("button", { name: "계정 삭제" }).click();
      const dialog = cleanupPage.getByRole("dialog", { name: "계정 삭제 확인" });
      await dialog.getByLabel("확인 이메일").fill(email);
      await dialog.getByLabel("삭제 확인 문구").fill("계정 삭제");
      await dialog.getByLabel("삭제 비밀번호").fill(password);
      await dialog.getByRole("button", { name: "계정 삭제" }).click();
      await expect(cleanupPage).toHaveURL(/\/sign-in/);
      accountMayExist = false;
    } finally {
      await cleanupContext.close();
    }
  });

  test("creates, persists, exports, and removes only its own account through the product", async ({ browser }) => {
    if (!smokeOrigin) throw new Error("SMOKE_ORIGIN_MISSING");

    const context = await browser.newContext({ baseURL: smokeOrigin.origin, timezoneId: "Asia/Seoul" });
    const page = await context.newPage();
    try {
      const readiness = await page.request.get("/api/ready");
      expect(readiness.status()).toBe(200);
      await expect(readiness.json()).resolves.toEqual({ status: "ready" });

      await page.goto("/sign-up");
      await page.getByLabel("이메일").fill(email);
      await page.getByLabel("비밀번호").fill(password);
      accountMayExist = true;
      await page.getByRole("button", { name: "회원가입" }).click();
      await expect(page).toHaveURL(/\/onboarding\/profile$/);
      await expect(page.getByRole("heading", { name: "나를 먼저 알려주세요" })).toBeVisible();

      for (const path of ["/sign-in", "/today"]) {
        const response = await page.request.get(path);
        expect(response.headers()).toMatchObject({
          "x-content-type-options": "nosniff",
          "referrer-policy": "same-origin",
          "x-frame-options": "DENY",
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-resource-policy": "same-origin",
          "permissions-policy": "camera=(), microphone=(), geolocation=()",
        });
      }

      await page.getByLabel("닉네임").fill("Preview smoke");
      await page.getByLabel("나이").fill("25");
      await page.getByRole("radio", { name: "응답 안 함" }).check();
      await page.getByLabel("키").fill("165");
      await page.getByLabel("몸무게").fill("58");
      await page.getByLabel("생활 시간대").selectOption("Asia/Seoul");
      await page.getByRole("button", { name: "다음" }).click();

      await expect(page).toHaveURL(/\/onboarding\/habits$/);
      await expect(page.getByRole("heading", { name: "평소 습관을 골라주세요" })).toBeVisible();
      await page.getByRole("group", { name: "하루 평균 카페인 섭취량" }).getByRole("radio", { name: "1잔 내외" }).check();
      await page.getByRole("group", { name: "하루 평균 식사 횟수" }).getByRole("radio", { name: "2회" }).check();
      await page.getByRole("group", { name: "일주일 평균 음주 횟수" }).getByRole("radio", { name: "1~2회" }).check();
      await page.getByRole("group", { name: "일주일 평균 운동 횟수" }).getByRole("radio", { name: "2~3회" }).check();
      await page.getByRole("button", { name: "다음" }).click();

      await expect(page).toHaveURL(/\/onboarding\/sleep-goal$/);
      await expect(page.getByRole("heading", { name: "어떤 밤을 만들고 싶나요?" })).toBeVisible();
      await page.getByRole("button", { name: "시간 수정" }).click();
      await page.getByLabel("취침 시간").fill("23:30");
      await page.getByLabel("기상 시간").fill("07:00");
      await page.getByRole("button", { name: "시간 적용" }).click();
      await page.getByRole("button", { name: "다음" }).click();

      await expect(page).toHaveURL(/\/onboarding\/connect$/);
      await expect(page.getByRole("heading", { name: "가능한 데이터만 편하게 연결하세요" })).toBeVisible();
      await page.getByRole("button", { name: "수면 플랜 시작하기" }).click();

      await expect(page).toHaveURL(/\/today$/);
      await expect(page.getByRole("heading", { name: /오늘 밤,\s*23:30에\s*편안히 잠들기 위한 준비/ })).toBeVisible();

      await page.goto("/record/caffeine?step=confirm&brand=Smoke&product=Coffee&caffeineMg=80&consumedAt=2026-08-19T12%3A00");
      await expect(page.getByRole("heading", { name: "카페인 기록을 확인해요" })).toBeVisible();
      await page.getByRole("button", { name: "카페인 저장" }).click();
      await expect(page).toHaveURL(/\/record$/);

      await page.goto("/today");
      await expect(page.getByRole("heading", { name: /오늘 밤,\s*23:30에\s*편안히 잠들기 위한 준비/ })).toBeVisible();

      await page.goto("/plan");
      await expect(page.getByRole("heading", { name: "일정에 지장 없게 수면 리듬을 계획해요" })).toBeVisible();
      const majorEventForm = page.locator("#major-event-form");
      await majorEventForm.getByLabel("일정 이름").fill("Preview smoke event");
      await majorEventForm.getByLabel("일정 유형").fill("여행");
      await majorEventForm.getByLabel("시작 시간").fill(futureEventLocalDateTime(7));
      await majorEventForm.getByRole("button", { name: "주요 일정 추가" }).click();
      await expect(page.getByText("수면 조정 제안", { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(page.getByText("이 제안은 아직 계획에 반영되지 않았어요.", { exact: true }).filter({ visible: true })).toBeVisible();
      await page.getByRole("button", { name: "계획에 반영" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "변경 확인 및 반영" }).click();
      await expect(page.getByRole("heading", { name: "반영된 수면 계획" })).toBeVisible();

      await page.goto("/analyze");
      await expect(page.getByText(/내 몸의 리듬을\s*생활 기록으로 이해해요/)).toBeVisible();
      await page.goto("/care");
      await expect(page.getByRole("heading", { name: "오늘 밤 케어" })).toBeVisible();
      await page.goto("/account");
      await expect(page.getByRole("heading", { name: "나와 목표를 관리해요" })).toBeVisible();
      const exportButton = page.getByRole("button", { name: "내 데이터 내보내기" });
      await expect(exportButton).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      const exported = JSON.parse(await readFile(downloadPath!, "utf8")) as Record<string, unknown>;
      expect(exported).toMatchObject({
        schemaVersion: 1,
        identity: { email },
        planner: { events: expect.any(Array), plans: expect.any(Array), advice: expect.any(Array), revisions: expect.any(Array) },
        analyses: expect.any(Array),
        care: { routineCompletions: expect.any(Array), toolSessions: expect.any(Array) },
      });
      expect(exported.records).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "caffeine",
          fields: expect.objectContaining({ brand: "Smoke", product: "Coffee", caffeineMg: 80 }),
        }),
      ]));
      expect((exported.planner as { events: unknown[]; plans: unknown[] }).events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "여행" }),
      ]));
      expect((exported.planner as { events: unknown[]; plans: unknown[] }).plans.length).toBeGreaterThan(0);

      const signOut = await page.request.post("/api/auth/sign-out", { data: {} });
      expect(signOut.ok()).toBe(true);
      await page.goto("/account");
      await expect(page).toHaveURL(/\/sign-in/);
      await page.goto("/sign-in");
      await page.getByLabel("이메일").fill(email);
      await page.getByLabel("비밀번호").fill(password);
      await page.getByRole("button", { name: "로그인" }).click();
      await page.goto("/account");
      const profile = page.locator("#profile");
      await expect(profile.getByLabel("닉네임")).toHaveValue("Preview smoke");
      await expect(profile.getByLabel("로그인 이메일")).toHaveValue(email);
    } finally {
      await context.close();
    }
  });
});
