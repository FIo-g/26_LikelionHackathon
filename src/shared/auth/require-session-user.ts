import { cookies, headers } from "next/headers";
import { getAuth } from "@/shared/auth/auth";
import { isIsolatedE2eTestMode } from "@/shared/auth/e2e-test-mode";
import { UnauthorizedError } from "@/shared/auth/errors";

export type SessionIdentity = Readonly<{ userId: string; email: string | null }>;

type SessionApi = Readonly<{
  api: Readonly<{
    getSession: (input: Readonly<{ headers: unknown }>) => Promise<unknown>;
  }>;
}>;

const hasSessionApi = (value: unknown): value is SessionApi => (
  typeof value === "object"
  && value !== null
  && "api" in value
  && typeof (value as { api?: { getSession?: unknown } }).api?.getSession === "function"
);

export const requireSessionIdentity = async (): Promise<SessionIdentity> => {
  const e2eUserId = (await cookies()).get("adaptive-sleep-e2e-user")?.value;
  if (isIsolatedE2eTestMode() && e2eUserId === "e2e-planner-user") {
    return { userId: e2eUserId, email: "e2e-planner-user@local.test" };
  }

  let auth: unknown;
  try {
    auth = getAuth();
  } catch {
    throw new UnauthorizedError("Authentication is unavailable");
  }

  if (!hasSessionApi(auth)) throw new UnauthorizedError("Authentication is unavailable");
  let session: unknown;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    throw new UnauthorizedError("Authentication is unavailable");
  }

  const user = session && typeof session === "object" ? (session as { user?: { id?: unknown; email?: unknown } }).user : null;
  if (!user || typeof user.id !== "string" || !user.id) {
    throw new UnauthorizedError("No active session");
  }

  return { userId: user.id, email: typeof user.email === "string" ? user.email : null };
};

export const requireSessionUserId = async (): Promise<string> => (await requireSessionIdentity()).userId;
