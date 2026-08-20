import { NextResponse } from "next/server";

import { createExportUserData } from "@/modules/account/application/export-user-data";
import { readSensitiveActionSession, requireRecentAuthentication } from "@/modules/account/application/require-recent-authentication";
import { assertTrustedMutationOrigin, CorruptStoredPayloadError, exportRequestSchema, InvalidMutationOriginError, ReauthenticationError } from "@/modules/account/domain/export-schema";
import { createPrismaAccountDataRepository } from "@/modules/account/infrastructure/prisma-account-data-repository";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getPrismaClient } from "@/shared/db/prisma";
import { systemClock } from "@/shared/time/system-clock";

const error = (code: string, status: number): NextResponse => NextResponse.json({ code }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  try {
    assertTrustedMutationOrigin(request.headers.get("origin"));
  } catch (cause) {
    return error(cause instanceof InvalidMutationOriginError ? cause.code : "INVALID_MUTATION_ORIGIN", 403);
  }

  const session = await readSensitiveActionSession(request.headers);
  if (!session) return error("UNAUTHORIZED", 401);

  let input: { password: string | null };
  try {
    input = exportRequestSchema.parse(await request.json());
  } catch {
    return error("INVALID_EXPORT_REQUEST", 400);
  }

  try {
    await requireRecentAuthentication(session, input.password, request.headers, systemClock);
    const scope = await requireUserScope();
    if (scope.userId !== session.userId) return error("UNAUTHORIZED", 401);
    const exported = await createExportUserData(createPrismaAccountDataRepository(getPrismaClient()), systemClock)(scope);
    return new Response(JSON.stringify(exported), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"sleep-planner-${exported.exportedAt.slice(0, 10)}.json\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    if (cause instanceof ReauthenticationError) return error(cause.code, 401);
    if (cause instanceof CorruptStoredPayloadError) return error(cause.code, 500);
    return error("ACCOUNT_EXPORT_UNAVAILABLE", 500);
  }
}
