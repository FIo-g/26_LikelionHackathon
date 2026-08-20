import { NextResponse } from "next/server";

import { getPrismaClient } from "@/shared/db/prisma";
import { e2eIdentity } from "@/shared/auth/e2e-identity";
import { isIsolatedE2eTestMode } from "@/shared/auth/e2e-test-mode";

type E2ePrisma = {
  user: { upsert: (args: unknown) => Promise<unknown> };
  userProfile: { upsert: (args: unknown) => Promise<unknown>; deleteMany: (args: unknown) => Promise<unknown> };
  sleepGoal: { upsert: (args: unknown) => Promise<unknown>; deleteMany: (args: unknown) => Promise<unknown> };
  userHabit: { deleteMany: (args: unknown) => Promise<unknown> };
  connection: { deleteMany: (args: unknown) => Promise<unknown> };
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

const onboardingSetupMode = (request: Request): "completed" | "incomplete" | null => {
  const mode = new URL(request.url).searchParams.get("onboarding");
  if (mode === null || mode === "completed") return "completed";
  return mode === "incomplete" ? "incomplete" : null;
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!isIsolatedE2eTestMode()) {
    return new NextResponse(null, { status: 404 });
  }

  const onboardingMode = onboardingSetupMode(request);
  if (!onboardingMode) {
    return NextResponse.json({ code: "INVALID_E2E_SETUP_MODE" }, { status: 400 });
  }

  let identity;
  try {
    identity = e2eIdentity(await request.json());
  } catch {
    return NextResponse.json({ code: "INVALID_E2E_IDENTITY" }, { status: 400 });
  }

  const prisma = getPrismaClient() as unknown as E2ePrisma;
  const userId = identity.id;
  const now = new Date();
  await prisma.planRevision.deleteMany({ where: { userId } });
  await prisma.planDay.deleteMany({ where: { userId } });
  await prisma.scheduleAdvice.deleteMany({ where: { userId } });
  await prisma.sleepPlan.deleteMany({ where: { userId } });
  await prisma.specialEvent.deleteMany({ where: { userId } });
  await prisma.user.upsert({ where: { id: userId }, update: { email: identity.email }, create: { id: userId, email: identity.email } });

  if (onboardingMode === "incomplete") {
    await prisma.connection.deleteMany({ where: { userId } });
    await prisma.userHabit.deleteMany({ where: { userId } });
    await prisma.sleepGoal.deleteMany({ where: { userId } });
    await prisma.userProfile.deleteMany({ where: { userId } });
  } else {
    await prisma.userProfile.upsert({
      where: { userId },
      update: { nickname: "E2E User", timezone: "Asia/Seoul", onboardingCompletedAt: now },
      create: { userId, nickname: "E2E User", timezone: "Asia/Seoul", onboardingCompletedAt: now },
    });
    await prisma.sleepGoal.upsert({
      where: { userId },
      update: { targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
      create: { userId, targetBedTime: "23:00", targetWakeTime: "07:00", targetDurationMinutes: 480 },
    });
  }

  if (new URL(request.url).searchParams.get("seedPlan") === "1") {
    const plan = await prisma.sleepPlan.create({
      data: { userId, timezone: "Asia/Seoul", status: "active", activeKey: userId },
    });
    const historicalBed = plusMinutes(now, -1_440);
    const currentBed = plusMinutes(now, 60);
    const futureBed = plusMinutes(now, 1_500);
    const target = (bedAt: Date) => ({
      userId,
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

  const response = NextResponse.json({ identity });
  response.cookies.set("adaptive-sleep-e2e-user", userId, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 10 });
  return response;
}
