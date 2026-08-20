import { NextResponse } from "next/server";

import { cleanupE2eUser } from "@/shared/auth/cleanup-e2e-user";
import { e2eIdentity, isE2eUserId } from "@/shared/auth/e2e-identity";
import { isIsolatedE2eTestMode } from "@/shared/auth/e2e-test-mode";
import { requireSessionIdentity } from "@/shared/auth/require-session-user";
import { getPrismaClient } from "@/shared/db/prisma";

const e2eCookie = (request: Request): string | null => {
  const value = request.headers.get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("adaptive-sleep-e2e-user="))
    ?.slice("adaptive-sleep-e2e-user=".length);
  return value && isE2eUserId(value) ? value : null;
};

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!isIsolatedE2eTestMode()) return new NextResponse(null, { status: 404 });

  let input;
  try {
    input = await request.json();
    e2eIdentity(input);
  } catch {
    return NextResponse.json({ code: "INVALID_E2E_IDENTITY" }, { status: 400 });
  }

  try {
    const cookieUserId = e2eCookie(request);
    const authenticated = cookieUserId
      ? { userId: cookieUserId, email: null }
      : await requireSessionIdentity(request.headers);
    await cleanupE2eUser(getPrismaClient(), input, authenticated);
  } catch {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const response = NextResponse.json({ status: "cleaned" });
  response.cookies.delete("adaptive-sleep-e2e-user");
  return response;
}
