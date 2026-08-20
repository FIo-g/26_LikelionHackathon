import { auth } from "@/shared/auth/auth";
import type { Clock } from "@/shared/domain/contracts";
import { ReauthenticationError } from "../domain/export-schema";

const FRESH_SESSION_MS = 5 * 60_000;

export type SensitiveActionSession = Readonly<{
  userId: string;
  email: string;
  createdAt: Date;
}>;

type PasswordVerifier = Readonly<{
  api: Readonly<{
    verifyPassword?: (input: Readonly<{ body: { password: string }; headers: Headers }>) => Promise<unknown>;
  }>;
}>;

type SessionReader = Readonly<{
  api: Readonly<{
    getSession?: (input: Readonly<{ headers: Headers; query: { disableCookieCache: true } }>) => Promise<unknown>;
  }>;
}>;

const hasPasswordVerifier = (value: unknown): value is PasswordVerifier => (
  typeof value === "object"
  && value !== null
  && "api" in value
  && typeof (value as { api?: { verifyPassword?: unknown } }).api?.verifyPassword === "function"
);

const hasSessionReader = (value: unknown): value is SessionReader => (
  typeof value === "object"
  && value !== null
  && "api" in value
  && typeof (value as { api?: { getSession?: unknown } }).api?.getSession === "function"
);

const verificationSucceeded = (value: unknown): boolean => (
  !(typeof value === "object" && value !== null && "status" in value && (value as { status?: unknown }).status === false)
);

export const requireRecentAuthentication = async (
  session: SensitiveActionSession,
  password: string | null,
  requestHeaders: Headers,
  clock: Clock,
  verifier: unknown = auth,
): Promise<void> => {
  if (clock.now().getTime() - session.createdAt.getTime() <= FRESH_SESSION_MS) return;
  if (!password || !hasPasswordVerifier(verifier)) throw new ReauthenticationError();

  try {
    const result = await verifier.api.verifyPassword!({ body: { password }, headers: requestHeaders });
    if (!verificationSucceeded(result)) throw new Error("PASSWORD_VERIFICATION_FAILED");
  } catch {
    throw new ReauthenticationError();
  }
};

export const readSensitiveActionSession = async (
  requestHeaders: Headers,
  reader: unknown = auth,
): Promise<(SensitiveActionSession & { sessionId: string }) | null> => {
  if (!hasSessionReader(reader)) return null;
  try {
    const raw = await reader.api.getSession!({ headers: requestHeaders, query: { disableCookieCache: true } });
    const session = raw && typeof raw === "object" ? raw as { user?: { id?: unknown; email?: unknown }; session?: { id?: unknown; createdAt?: unknown } } : null;
    const createdAt = session?.session?.createdAt instanceof Date ? session.session.createdAt : new Date(typeof session?.session?.createdAt === "string" ? session.session.createdAt : "");
    if (!session || typeof session.user?.id !== "string" || !session.user.id || typeof session.user.email !== "string" || !session.user.email || typeof session.session?.id !== "string" || !session.session.id || Number.isNaN(createdAt.getTime())) return null;
    return { userId: session.user.id, email: session.user.email, sessionId: session.session.id, createdAt };
  } catch {
    return null;
  }
};
