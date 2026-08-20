import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { OnboardingIncompleteError, UnauthorizedError } from "@/shared/auth/errors";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getPrismaClient } from "@/shared/db/prisma";
import { AppShell } from "@/shared/ui/app-shell/app-shell";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  let scope: Awaited<ReturnType<typeof requireUserScope>>;
  try {
    scope = await requireUserScope();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/sign-in");
    }
    if (error instanceof OnboardingIncompleteError) {
      redirect("/onboarding/profile");
    }
    throw error;
  }

  const profile = await (getPrismaClient() as unknown as {
    userProfile: { findUnique: (args: { where: { userId: string }; select: { nickname: true } }) => Promise<{ nickname: string | null } | null> };
  }).userProfile.findUnique({ where: { userId: scope.userId }, select: { nickname: true } });

  return <AppShell profileName={profile?.nickname?.trim() || "내 프로필"}>{children}</AppShell>;
}
