import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingIncompleteError, UnauthorizedError } from "@/shared/auth/errors";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import { requireUserScope } from "@/shared/auth/require-user-scope";

const { mockGetSession, mockFindUnique, mockCookieGet, authContainer } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCookieGet: vi.fn(),
  authContainer: { api: { getSession: vi.fn() } as { getSession?: typeof mockGetSession } },
}));

vi.mock("@/shared/auth/auth", () => ({
  auth: authContainer,
}));

vi.mock("@/shared/db/prisma", () => ({
  getPrismaClient: () => ({
    userProfile: {
      findUnique: mockFindUnique,
    },
  }),
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: mockCookieGet }),
}));

describe("auth session guards", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    mockGetSession.mockReset();
    mockFindUnique.mockReset();
    mockCookieGet.mockReset();
    authContainer.api.getSession = mockGetSession;
  });

  it("throws UnauthorizedError when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(requireSessionUserId()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("fails closed with UnauthorizedError when the Auth API is unavailable", async () => {
    delete authContainer.api.getSession;
    await expect(requireSessionUserId()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a forgeable E2E cookie unless isolated test mode is explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADAPTIVE_SLEEP_E2E_TEST_MODE", "1");
    mockCookieGet.mockReturnValue({ value: "e2e-planner-user" });
    delete authContainer.api.getSession;

    await expect(requireSessionUserId()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns user id from session user", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u-1" } });
    const userId = await requireSessionUserId();
    expect(userId).toBe("u-1");
  });

  it("throws OnboardingIncompleteError when profile is incomplete", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u-2" } });
    mockFindUnique.mockResolvedValue({
      timezone: null,
      onboardingCompletedAt: null,
    });

    await expect(requireUserScope()).rejects.toBeInstanceOf(OnboardingIncompleteError);
  });

  it("returns owned user scope after completion", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u-3" } });
    mockFindUnique.mockResolvedValue({
      timezone: "Asia/Seoul",
      onboardingCompletedAt: new Date("2026-08-19T00:00:00Z"),
    });

    await expect(requireUserScope()).resolves.toEqual({
      userId: "u-3",
      timezone: "Asia/Seoul",
    });
  });
});
