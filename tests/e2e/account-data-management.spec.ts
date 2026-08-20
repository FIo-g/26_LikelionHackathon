import { expect, setupE2eUser, test } from "./fixtures";

test("keeps account export and destructive deletion behind an accessible reauthentication flow", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/account");

  const management = page.getByTestId("account-data-management");
  await expect(management).toBeVisible();
  await expect(management.getByRole("button", { name: "내 데이터 내보내기" })).toBeVisible();

  await management.getByRole("button", { name: "계정 삭제" }).click();
  const dialog = page.getByRole("dialog", { name: "계정 삭제 확인" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("확인 이메일")).toBeVisible();
  await expect(dialog.getByLabel("삭제 확인 문구")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "계정 삭제" })).toBeDisabled();

  await dialog.getByLabel("확인 이메일").fill("e2e@example.invalid");
  await dialog.getByLabel("삭제 확인 문구").fill("계정 삭제");
  await expect(dialog.getByRole("button", { name: "계정 삭제" })).toBeEnabled();
  await dialog.getByRole("button", { name: "계정 삭제" }).click();
  await expect(dialog.getByRole("alert")).toContainText("다시 로그인");
  await expect(page.getByRole("heading", { name: "계정 설정" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(management.getByRole("button", { name: "계정 삭제" })).toBeFocused();
});

test("fails closed for the export API when the isolated E2E cookie is not a Better Auth session", async ({ page }, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  const response = await page.request.post("/api/account/export", {
    headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    data: { password: null },
  });
  await expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
});
