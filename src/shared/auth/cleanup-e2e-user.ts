import type { PrismaClient } from "@/generated/prisma/client";
import { deleteAllRecordRows } from "@/modules/account/application/delete-user-account";
import { e2eIdentity, type E2eIdentityInput } from "@/shared/auth/e2e-identity";

export const cleanupE2eUser = async (
  prisma: PrismaClient,
  input: E2eIdentityInput,
  authenticated: Readonly<{ userId: string; email: string | null }>,
): Promise<void> => {
  const expected = e2eIdentity(input);
  if (authenticated.userId !== expected.id) {
    throw new Error("E2E_CLEANUP_IDENTITY_MISMATCH");
  }
  if (authenticated.email !== null && authenticated.email !== expected.email) {
    throw new Error("E2E_CLEANUP_IDENTITY_MISMATCH");
  }

  await prisma.$transaction(async (transaction) => {
    const where = { userId: expected.id };
    await transaction.session.deleteMany({ where });
    await transaction.narration.deleteMany({ where });
    await transaction.impactFactor.deleteMany({ where: { analysisSnapshot: { userId: expected.id } } });
    await transaction.analysisSnapshot.deleteMany({ where });
    await transaction.baselineSnapshot.deleteMany({ where });
    await transaction.planRevision.deleteMany({ where });
    await transaction.planDay.deleteMany({ where });
    await transaction.scheduleAdvice.deleteMany({ where });
    await transaction.sleepPlan.deleteMany({ where });
    await transaction.specialEvent.deleteMany({ where });
    await transaction.routineCompletion.deleteMany({ where });
    await transaction.careToolSession.deleteMany({ where });
    await deleteAllRecordRows(transaction, { userId: expected.id, timezone: "UTC" });
    await transaction.mutationReceipt.deleteMany({ where });
    await transaction.dailyLog.deleteMany({ where });
    await transaction.connection.deleteMany({ where });
    await transaction.userHabit.deleteMany({ where });
    await transaction.sleepGoal.deleteMany({ where });
    await transaction.userProfile.deleteMany({ where });
    await transaction.account.deleteMany({ where });
    await transaction.verification.deleteMany({
      where: { identifier: { in: [expected.id, expected.email] } },
    });
    await transaction.user.deleteMany({ where: { id: expected.id } });
  });
};
