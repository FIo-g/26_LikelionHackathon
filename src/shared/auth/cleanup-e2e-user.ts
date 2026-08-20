import type { PrismaClient } from "@/generated/prisma/client";
import { e2eIdentity, type E2eIdentityInput } from "@/shared/auth/e2e-identity";

export const cleanupE2eUser = async (
  prisma: PrismaClient,
  input: E2eIdentityInput,
  authenticated: Readonly<{ userId: string; email: string | null }>,
): Promise<void> => {
  const expected = e2eIdentity(input);
  if (authenticated.userId !== expected.id && authenticated.email !== expected.email) {
    throw new Error("E2E_CLEANUP_IDENTITY_MISMATCH");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.verification.deleteMany({
      where: { identifier: { in: [expected.id, expected.email] } },
    });
    await transaction.user.deleteMany({ where: { id: authenticated.userId } });
  });
};
