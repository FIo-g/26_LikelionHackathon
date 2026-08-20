import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { OnboardingIncompleteError, UnauthorizedError } from "@/shared/auth/errors";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { AppShell } from "@/shared/ui/app-shell/app-shell";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  try {
    await requireUserScope();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/sign-in");
    }
    if (error instanceof OnboardingIncompleteError) {
      redirect("/onboarding/connect");
    }
    throw error;
  }

  return <AppShell>{children}</AppShell>;
}
