import { redirect } from "next/navigation";
import type { OnboardingProgressData } from "@/modules/onboarding/domain/types";

export type OnboardingRouteStep = "profile" | "habits" | "sleep-goal" | "connect";

const PATH_BY_STEP: Readonly<Record<OnboardingRouteStep, string>> = {
  profile: "/onboarding/profile",
  habits: "/onboarding/habits",
  "sleep-goal": "/onboarding/sleep-goal",
  connect: "/onboarding/connect",
};

/**
 * Route rendering is only a convenience guard. Each final mutation is still
 * validated and ownership-checked in its server action/repository.
 */
export const firstMissingPrerequisitePath = (
  progress: OnboardingProgressData,
  route: OnboardingRouteStep,
): string | null => {
  if (route !== "profile" && !progress.profile) return PATH_BY_STEP.profile;
  if ((route === "sleep-goal" || route === "connect") && !progress.habits) {
    return PATH_BY_STEP.habits;
  }
  if (route === "connect" && !progress.sleepGoal) return PATH_BY_STEP["sleep-goal"];

  return null;
};

export const redirectIfOnboardingPrerequisiteIsMissing = (
  progress: OnboardingProgressData,
  route: OnboardingRouteStep,
): void => {
  const path = firstMissingPrerequisitePath(progress, route);
  if (path) redirect(path);
};
