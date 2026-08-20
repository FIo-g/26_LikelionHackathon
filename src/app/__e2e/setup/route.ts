import { NextResponse } from "next/server";

import { getPrismaClient } from "@/shared/db/prisma";
import { isIsolatedE2eTestMode } from "@/shared/auth/e2e-test-mode";

const E2E_USER_ID = "e2e-planner-user";

type E2ePrisma = {
  user: { upsert: (args: unknown) => Promise<unknown> };
  userProfile: { upsert: (args: unknown) => Promise<unknown> };
  sleepGoal: { upsert: (args: unknown) => Promise<unknown> };
  specialEvent: { deleteMany: (args: unknown) => Promise<unknown> };
  scheduleAdvice: { deleteMany: (args: unknown) => Promise<unknown> };
  sleepPlan: { deleteMany: (args: unknown) => Promise<unknown>; create: (args: unknown) => Promise<{ id: string }> };
  planDay: { deleteMany: (args: unknown) => Promise<unknown>; createMany: (args: unknown) => Promise<unknown> };
  planRevision: { deleteMany: (args: unknown) => Promise<unknown> };
};

const localDate = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const plusMinutes = (instant: Date, minutes: number): Date => new Date(instant.getTime() + minutes * 60_000);

export async function POST(request: Request): Promise<NextResponse> {
  if (!isIsolatedE2eTestMode()) {
    return new NextResponse(null, { status: 404 });
  }

  const prisma = getPrismaClient() as unknown as E2ePrisma;
  const now = new Date();
  await prisma.planRevision.deleteMany({ where: { userId: E2E_USER_ID } });
  await prisma.planDay.deleteMany({ where: { userId: E2E_USER_ID } });
  await prisma.scheduleAdvice.deleteMany({ where: { userId: E2E_USER_ID } });
  await prisma.sleepPlan.deleteMany({ where: { userId: E2E_USER_ID } });
  await prisma.specialEvent.deleteMany({ where: { userId: E2E_USER_ID } });
  await prisma.user.upsert({ where: { id: E2E_USER_ID }, update: {}, create: { id: E2E_USER_ID } });
  await prisma.userProfile.upsert({
    where: { userId: E2E_USER_ID },
    update: { nickname: "E2E User", timezone: "Asia/Seoul", onboardingCompletedAt: now },
    create: { userId: E2E_USER_ID, nickname: "E2E User", timezone: "Asia/Seoul", onboardingCompletedAt: now },
  });
  await prisma.sleepGoal.upsert({
    where: { userId: E2E_USER_ID },
    update: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
    create: { userId: E2E_USER_ID, targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
  });

  if (new URL(request.url).searchParams.get("seedPlan") === "1") {
    const plan = await prisma.sleepPlan.create({
      data: { userId: E2E_USER_ID, timezone: "Asia/Seoul", status: "active", activeKey: E2E_USER_ID },
    });
    const historicalBed = plusMinutes(now, -1_440);
    const currentBed = plusMinutes(now, 60);
    const futureBed = plusMinutes(now, 1_500);
    const target = (bedAt: Date) => ({
      userId: E2E_USER_ID,
      planId: plan.id,
      localDate: localDate(plusMinutes(bedAt, 480)),
      timezone: "Asia/Seoul",
      targetBedAt: bedAt,
      targetWakeAt: plusMinutes(bedAt, 480),
      caffeineCutoffAt: plusMinutes(bedAt, -120),
      exerciseCutoffAt: plusMinutes(bedAt, -90),
      mealCutoffAt: plusMinutes(bedAt, -60),
      windDownAt: plusMinutes(bedAt, -30),
      status: "active",
      activeKey: `${plan.id}:${localDate(plusMinutes(bedAt, 480))}`,
    });
    await prisma.planDay.createMany({ data: [target(historicalBed), target(currentBed), target(futureBed)] });
  }

  const response = NextResponse.json({ message: "E2E planner user ready" });
  response.cookies.set("adaptive-sleep-e2e-user", E2E_USER_ID, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 10 });
  return response;
}
