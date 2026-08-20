export type EntryPath = "/sign-in" | "/onboarding/profile" | "/today";

export function resolveEntryPath(input: Readonly<{
  userId: string | null;
  onboardingCompletedAt: Date | null;
}>): EntryPath {
  if (!input.userId) {
    return "/sign-in";
  }

  return input.onboardingCompletedAt ? "/today" : "/onboarding/profile";
}

export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  const url = new URL(value, "https://sleep-planner.invalid");
  if (url.origin !== "https://sleep-planner.invalid") {
    return "/";
  }

  return `${url.pathname}${url.search}`;
}
