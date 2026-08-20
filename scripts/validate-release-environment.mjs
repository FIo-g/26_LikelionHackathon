import { pathToFileURL } from "node:url";

const requiredKeys = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "AUTH_RATE_LIMIT_ENABLED",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
];

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

export const isReleaseValidationEnabled = (environment = process.env) => (
  environment.VERCEL === "1" || environment.ADAPTIVE_SLEEP_RELEASE_VALIDATION === "1"
);

export const assertReleaseEnvironment = (environment = process.env) => {
  const invalid = requiredKeys.filter((key) => !isNonEmptyString(environment[key]));
  if (isNonEmptyString(environment.DATABASE_URL)) {
    try {
      if (new URL(environment.DATABASE_URL).protocol !== "postgresql:") invalid.push("DATABASE_URL");
    } catch {
      invalid.push("DATABASE_URL");
    }
  }
  if (!isNonEmptyString(environment.BETTER_AUTH_SECRET) || environment.BETTER_AUTH_SECRET.trim().length < 32) {
    invalid.push("BETTER_AUTH_SECRET");
  }
  if (isNonEmptyString(environment.BETTER_AUTH_URL)) {
    try {
      if (new URL(environment.BETTER_AUTH_URL).protocol !== "https:") invalid.push("BETTER_AUTH_URL");
    } catch {
      invalid.push("BETTER_AUTH_URL");
    }
  }
  if (environment.AUTH_RATE_LIMIT_ENABLED !== "true") invalid.push("AUTH_RATE_LIMIT_ENABLED");
  if (environment.OPENAI_MODEL !== "gpt-5.6-luna") invalid.push("OPENAI_MODEL");
  if (invalid.length) {
    throw new Error(`RELEASE_ENVIRONMENT_INVALID:${[...new Set(invalid)].sort().join(",")}`);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && isReleaseValidationEnabled()) {
  assertReleaseEnvironment();
}
