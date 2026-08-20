import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/shared/auth/auth";
import { getPrismaClient } from "@/shared/db/prisma";
import { resolveEntryPath } from "@/shared/auth/entry-path";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user?.id ?? null;

  if (!userId) {
    redirect("/sign-in");
  }

  const prisma = getPrismaClient() as {
    userProfile?: {
      findUnique: (args: unknown) => Promise<{
        onboardingCompletedAt: Date | null;
      } | null>;
    };
  };

  const userProfile = await prisma.userProfile?.findUnique({
    where: { userId },
    select: { onboardingCompletedAt: true },
  });

  const onboardingCompletedAt = userProfile?.onboardingCompletedAt ?? null;
  const entryPath = resolveEntryPath({ userId, onboardingCompletedAt });
  redirect(entryPath);
}
