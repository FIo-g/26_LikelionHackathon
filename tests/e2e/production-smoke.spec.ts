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

  test("creates, persists, exports, and removes only its own account through the product", async ({ page }) => {
    const readiness = await page.request.get("/api/ready");
    expect(readiness.status()).toBe(200);
    await expect(readiness.json()).resolves.toEqual({ status: "ready" });

    await page.goto("/sign-up");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    accountMayExist = true;
    await page.getByRole("button", { name: "회원가입" }).click();

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

    await page.goto("/onboarding/profile");
    await page.getByLabel("닉네임").fill("Preview smoke");
    await page.getByRole("button", { name: "다음" }).click();
    await page.goto("/onboarding/sleep-goal");
    await page.getByRole("button", { name: "다음" }).click();
    await page.goto("/onboarding/habits");
    await page.getByRole("button", { name: "다음" }).click();
    await page.goto("/onboarding/connect");
    await page.getByRole("button", { name: "연결하기" }).click();

    await page.goto("/record/caffeine?step=confirm&brand=Smoke&product=Coffee&caffeineMg=80&consumedAt=2026-08-19T12%3A00");
    await page.getByRole("button", { name: "카페인 저장" }).click();
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "오늘" })).toBeVisible();

    await page.goto("/plan");
    await page.getByLabel("일정 이름").fill("Preview smoke event");
    await page.getByLabel("일정 유형").fill("travel");
    await page.getByLabel("시작 시간").fill("2026-08-26T09:00");
    await page.getByRole("button", { name: "주요 일정 추가" }).click();
    await page.getByRole("button", { name: "계획에 반영" }).click();
    await page.getByRole("button", { name: "변경 확인 및 반영" }).click();

    await page.goto("/analyze");
    await expect(page.getByRole("heading", { name: "분석" })).toBeVisible();
    await page.goto("/care");
    await expect(page.getByRole("heading", { name: "Care" })).toBeVisible();
    await page.goto("/account");
    const exportButton = page.getByRole("button", { name: "내 데이터 내보내기" });
    await expect(exportButton).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const exported = JSON.parse(await readFile(downloadPath!, "utf8")) as Record<string, unknown>;
    expect(exported).toMatchObject({
      schemaVersion: 1,
      identity: { email },
      records: expect.any(Array),
      planner: { events: expect.any(Array), plans: expect.any(Array), advice: expect.any(Array), revisions: expect.any(Array) },
      analyses: expect.any(Array),
      care: { routineCompletions: expect.any(Array), toolSessions: expect.any(Array) },
    });

    const signOut = await page.request.post("/api/auth/sign-out", { data: {} });
    expect(signOut.ok()).toBe(true);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/sign-in");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.goto("/account");
    await expect(page.getByLabel("닉네임").first()).toHaveValue("Preview smoke");
    await expect(page.getByLabel("로그인 이메일").first()).toHaveValue(email);
  });
});
