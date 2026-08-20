import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { getPrismaClient } from "@/shared/db/prisma";

export default async function OnboardingLayout({ children }: Readonly<{ children: ReactNode }>) {
  const userId = await requireSessionUserId().catch(() => null);
  if (!userId) {
    redirect("/sign-in");
  }

  const prisma = getPrismaClient();
  if (userId) {
    const profile = await (prisma as {
      userProfile?: {
        findUnique: (args: {
          where: { userId: string };
          select: { onboardingCompletedAt: true };
        }) => Promise<{ onboardingCompletedAt: Date | null } | null>;
      };
    }).userProfile?.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true },
    });

    if (profile?.onboardingCompletedAt) {
      redirect("/today");
    }
  }

  return (
    <main>
      {children}
    </main>
  );
}
