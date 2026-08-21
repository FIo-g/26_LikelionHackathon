import { expect, setupE2eUser, test } from "./fixtures";

type CaffeineChoice = Readonly<{
  brand: "스타벅스" | "그 외";
  product: string;
}>;

const choices: readonly CaffeineChoice[] = [
  { brand: "스타벅스", product: "아메리카노" },
  { brand: "그 외", product: "직접 입력 커피" },
];

for (const choice of choices) {
  test(`marks today's caffeine as recorded after saving ${choice.brand}`, async ({ page }, testInfo) => {
    await setupE2eUser(page.request, testInfo);
    await page.goto("/record/caffeine?step=brand&mode=create");

    await page.getByRole("button", { name: new RegExp(`^${choice.brand}`) }).click();
    await page.getByRole("button", { name: "메뉴 선택하기" }).click();
    if (choice.brand === "스타벅스") {
      await page.getByRole("button", { name: /^아메리카노/ }).click();
    } else {
      await page.getByLabel("제품명", { exact: true }).fill(choice.product);
    }
    await page.getByLabel("카페인(mg)", { exact: true }).fill("120");
    await page.getByRole("button", { name: "수치 확인하기" }).click();
    await page.getByRole("button", { name: "카페인 저장" }).click();

    await expect(page).toHaveURL(/\/record$/);
    await page.goto("/today");

    const dataStatus = page.getByRole("heading", { name: "오늘의 데이터 상태" }).locator("..");
    await expect(dataStatus).toContainText("1/7 항목 기준 충족");
    await expect(dataStatus).not.toContainText("카페인 미기록");
  });
}
