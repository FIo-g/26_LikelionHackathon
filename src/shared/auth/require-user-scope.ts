import { getPrismaClient } from "@/shared/db/prisma";
import { UserScope } from "@/shared/domain/contracts";
import { OnboardingIncompleteError } from "@/shared/auth/errors";
import { requireSessionUserId } from "@/shared/auth/require-session-user";

export const requireUserScope = async (): Promise<UserScope> => {
  const userId = await requireSessionUserId();
  const prisma = getPrismaClient() as {
    userProfile?: {
      findUnique: (args: unknown) => Promise<{
        timezone: string | null;
        onboardingCompletedAt: Date | null;
      } | null>;
    };
  };

  const profile = await prisma.userProfile?.findUnique({
    where: { userId },
    select: {
      timezone: true,
      onboardingCompletedAt: true,
    },
  });

  if (!profile?.timezone || !profile?.onboardingCompletedAt) {
    throw new OnboardingIncompleteError();
  }

  return {
    userId,
    timezone: profile.timezone,
  };
};
