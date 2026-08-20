import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL;
const smokeOrigin = baseUrl ? new URL(baseUrl) : null;
const describePreview = smokeOrigin?.protocol === "https:" && smokeOrigin.hostname.endsWith(".vercel.app")
  ? test.describe
  : test.describe.skip;
const email = `smoke-${crypto.randomUUID()}@example.invalid`;
const password = "Smoke-passphrase-2026";

describePreview("deployed preview smoke", () => {
  test("creates and removes only its own account through the product", async ({ page }) => {
    try {
      const readiness = await page.request.get("/api/ready");
      expect(readiness.status()).toBe(200);
      await expect(readiness.json()).resolves.toEqual({ status: "ready" });

      await page.goto("/sign-up");
      await page.getByLabel("이메일").fill(email);
      await page.getByLabel("비밀번호").fill(password);
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
      await expect(page.getByRole("button", { name: "내 데이터 내보내기" })).toBeVisible();
      await page.getByRole("button", { name: "내 데이터 내보내기" }).click();
    } finally {
      if (await page.getByRole("button", { name: "계정 삭제" }).count()) {
        await page.getByRole("button", { name: "계정 삭제" }).click();
        const dialog = page.getByRole("dialog", { name: "계정 삭제 확인" });
        await dialog.getByLabel("확인 이메일").fill(email);
        await dialog.getByLabel("삭제 확인 문구").fill("계정 삭제");
        await dialog.getByLabel("삭제 비밀번호").fill(password);
        await dialog.getByRole("button", { name: "계정 삭제" }).click();
      }
    }
  });
});
