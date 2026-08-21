import { expect, setupE2eUser, test } from "./fixtures";

const koreaLocalDateTime = (minutesAgo = 0): string => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() - minutesAgo * 60_000));
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const koreaLocalDate = (): string => koreaLocalDateTime().slice(0, 10);

test("protects record hub without session", async ({ page }) => {
  await page.goto("/record");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("protects every intake flow without session", async ({ page }) => {
  await page.goto("/record/caffeine");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();

  await page.goto("/record/alcohol");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();

  await page.goto("/record/meal-health");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();

  await page.goto("/record/sleep-phone");
  await expect(page.getByRole("heading", { name: "반가워요" })).toBeVisible();
});

test("shows distinct record cards and routes the quick-record CTA to a live form", async ({
  page,
}, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/record");

  await expect(
    page.getByRole("link", { name: "빠른 기록 시작" }),
  ).toHaveAttribute("href", "/record/caffeine?step=brand&mode=create");

  const expectedRoutes = [
    ["카페인", "/record/caffeine?step=brand&mode=create"],
    ["알코올", "/record/alcohol?step=type&mode=create"],
    ["식사", "/record/meal-health?step=meal&focus=meal&mode=create"],
    [
      "운동",
      "/record/meal-health?step=exercise-and-wellness&focus=exercise&mode=create",
    ],
    ["휴대폰", "/record/sleep-phone?step=phone&focus=phone&mode=create"],
    ["어젯밤 수면", "/record/sleep-phone?step=sleep&focus=sleep&mode=create"],
  ] as const;

  for (const [name, href] of expectedRoutes) {
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name }) });
    await expect(card.getByRole("link", { name: "추가" })).toHaveAttribute(
      "href",
      href,
    );
  }

  await page.getByRole("link", { name: "빠른 기록 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "어디서 마셨나요?" }),
  ).toBeVisible();
});

test("starts a fresh record from the quick CTA even when an abandoned edit draft exists", async ({
  page,
}, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/record");
  await page.evaluate(() => {
    window.sessionStorage.setItem(
      "record-draft:/record/caffeine",
      JSON.stringify({
        schemaVersion: 1,
        draft: {
          step: "confirm",
          values: { recordId: "stale-record-id", brand: "수정 중인 카페" },
          idempotencyKey: "ce25b866-6228-41a7-8c3d-a5d40c6f7a88",
          expiresAt: Date.now() + 60_000,
        },
      }),
    );
  });

  await page.getByRole("link", { name: "빠른 기록 시작" }).click();

  await expect(page).toHaveURL(/\/record\/caffeine\?step=brand&mode=create$/);
  await expect(page.getByLabel("브랜드", { exact: true })).toHaveValue("");
});

test("keeps an unfinished create draft and idempotency key through a fresh-create reload", async ({
  page,
}, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/record/caffeine?step=brand&mode=create");

  await page.getByLabel("브랜드", { exact: true }).fill("재시도 카페");
  const idempotencyKey = await page
    .locator('input[name="idempotencyKey"]')
    .inputValue();

  await page.reload();

  await expect(page).toHaveURL(/\/record\/caffeine\?step=brand&mode=create$/);
  await expect(page.getByLabel("브랜드", { exact: true })).toHaveValue(
    "재시도 카페",
  );
  await expect(page.locator('input[name="idempotencyKey"]')).toHaveValue(
    idempotencyKey,
  );

  await page.getByRole("button", { name: "메뉴 선택하기" }).click();
  await page.getByRole("button", { name: /아메리카노/ }).click();
  await page.getByLabel("카페인(mg)", { exact: true }).fill("80");
  await page
    .getByLabel("마신 시각", { exact: true })
    .fill(koreaLocalDateTime());
  await page.getByRole("button", { name: "수치 확인하기" }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(await page.locator('input[name="items"]').inputValue())[0]
          ?.recordId,
    )
    .toBeUndefined();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  const caffeineCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "카페인" }) });
  await expect(caffeineCard).toContainText("저장 1건");
});

test("creates, edits, and deletes a caffeine record through the visible intake controls", async ({
  page,
}, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/record/caffeine");
  await page.getByRole("button", { name: /스타벅스/ }).click();
  await expect(page.getByLabel("브랜드", { exact: true })).toHaveValue(
    "스타벅스",
  );
  await page.getByRole("button", { name: "메뉴 선택하기" }).click();
  await page.getByRole("button", { name: /아메리카노/ }).click();
  await page.getByLabel("카페인(mg)", { exact: true }).fill("150");
  await page
    .getByLabel("마신 시각", { exact: true })
    .fill(koreaLocalDateTime());
  await page.getByRole("button", { name: "수치 확인하기" }).click();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  const caffeineCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "카페인" }) });
  await expect(caffeineCard.getByText("완료", { exact: true })).toBeVisible();

  await caffeineCard.getByRole("link", { name: "수정" }).click();
  await expect(
    page.getByRole("heading", { name: "어디서 마셨나요?" }),
  ).toBeVisible();
  await expect(page.getByLabel("브랜드", { exact: true })).toHaveValue(
    "스타벅스",
  );
  await page.getByLabel("브랜드", { exact: true }).fill("동네 카페");
  await page.getByRole("button", { name: "메뉴 선택하기" }).click();
  await page.getByRole("button", { name: "수치 확인하기" }).click();
  await page.getByRole("button", { name: "카페인 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  const updatedCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "카페인" }) });
  page.once("dialog", (dialog) => dialog.accept());
  await updatedCard.getByRole("button", { name: "삭제" }).click();
  await expect(updatedCard.getByText("미입력", { exact: true })).toBeVisible();
});

test("persists an alcohol can unit, restores it for editing, and deletes the record", async ({
  page,
}, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  await page.goto("/record");

  const alcoholCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "알코올" }) });
  await alcoholCard.getByRole("link", { name: "추가" }).click();
  await expect(page).toHaveURL(/\/record\/alcohol\?step=type&mode=create$/);
  await page.getByRole("button", { name: /맥주/ }).click();
  await page.getByRole("button", { name: "양 입력하기" }).click();
  await page.getByLabel("마신 양(기록 단위)", { exact: true }).fill("2");
  await page.getByLabel("마신 양 기준", { exact: true }).selectOption("can");
  await page
    .getByLabel("마신 시각", { exact: true })
    .fill(koreaLocalDateTime());
  await page.getByRole("button", { name: "기록 확인" }).click();
  await page.getByRole("button", { name: "음주 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  await alcoholCard.getByRole("link", { name: "수정" }).click();
  await expect(page).toHaveURL(/\/record\/alcohol\?step=type$/);
  await page.getByRole("button", { name: "양 입력하기" }).click();
  await expect(page.getByLabel("마신 양 기준", { exact: true })).toHaveValue(
    "can",
  );
  await page.getByLabel("마신 양(기록 단위)", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "기록 확인" }).click();
  await page.getByRole("button", { name: "음주 저장" }).click();

  await expect(page).toHaveURL(/\/record$/);
  const updatedAlcoholCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "알코올" }) });
  page.once("dialog", (dialog) => dialog.accept());
  await updatedAlcoholCard.getByRole("button", { name: "삭제" }).click();
  await expect(
    updatedAlcoholCard.getByText("미입력", { exact: true }),
  ).toBeVisible();
});

test("persists exercise and wellness records and appends a second exercise instead of replacing the first", async ({
  page,
}, testInfo) => {
  await setupE2eUser(page.request, testInfo);
  const localDate = koreaLocalDate();

  const openNewExerciseAndWellness = async () => {
    await page.goto("/record");
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "운동" }) });
    await card.getByRole("link", { name: "추가" }).click();
    await expect(page).toHaveURL(
      /\/record\/meal-health\?step=exercise-and-wellness&focus=exercise&mode=create$/,
    );
  };
  const saveExerciseAndWellness = async (
    exerciseType: string,
    startedAt: string,
    endedAt: string,
  ) => {
    await page.getByLabel("운동", { exact: true }).fill(exerciseType);
    await page.getByLabel("운동 시작", { exact: true }).fill(startedAt);
    await page.getByLabel("운동 종료", { exact: true }).fill(endedAt);
    await page.getByLabel("평균 심박수", { exact: true }).fill("120");
    await page.getByLabel("피로도", { exact: true }).fill("2");
    await page.getByLabel("스트레스", { exact: true }).fill("3");
    await page.getByLabel("컨디션 날짜", { exact: true }).fill(localDate);
    await page.getByRole("button", { name: "기록 확인" }).click();
    await page.getByRole("button", { name: "운동·컨디션 저장" }).click();
    await expect(page).toHaveURL(/\/record$/);
  };

  await openNewExerciseAndWellness();
  await saveExerciseAndWellness(
    "조깅",
    koreaLocalDateTime(3),
    koreaLocalDateTime(2),
  );

  const firstExerciseCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "운동" }) });
  await expect(
    firstExerciseCard.getByRole("link", { name: "수정" }),
  ).toHaveAttribute(
    "href",
    "/record/meal-health?step=exercise-and-wellness&focus=exercise",
  );
  await firstExerciseCard.getByRole("link", { name: "수정" }).click();
  await expect(page).toHaveURL(
    /\/record\/meal-health\?step=exercise-and-wellness&focus=exercise$/,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sessionStorage.getItem(
          "record-draft:/record/meal-health:exercise",
        ),
      ),
    )
    .toContain("exerciseRecordId");
  await expect(page.getByLabel("운동", { exact: true })).toHaveValue("조깅");
  await openNewExerciseAndWellness();
  await expect(page.getByLabel("운동", { exact: true })).toHaveValue("걷기");
  await saveExerciseAndWellness(
    "요가",
    koreaLocalDateTime(1),
    koreaLocalDateTime(),
  );

  const exerciseCard = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "운동" }) });
  await expect(exerciseCard.getByText("완료", { exact: true })).toBeVisible();
  await expect(exerciseCard).toContainText("저장 2건");
  await expect(exerciseCard).toContainText("컨디션 2건");
  page.once("dialog", (dialog) => dialog.accept());
  await exerciseCard.getByRole("button", { name: "삭제" }).click();
  await expect(exerciseCard.getByText("미입력", { exact: true })).toBeVisible();
});
