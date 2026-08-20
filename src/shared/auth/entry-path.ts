export type EntryPath = "/sign-in" | "/onboarding/connect" | "/today";

export function resolveEntryPath(input: Readonly<{
  userId: string | null;
  onboardingCompletedAt: Date | null;
}>): EntryPath {
  if (!input.userId) {
    return "/sign-in";
  }

  return input.onboardingCompletedAt ? "/today" : "/onboarding/connect";
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
