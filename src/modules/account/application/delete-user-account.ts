import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import {
  AccountDeletionConfirmationError,
  AccountDeletionRaceError,
} from "../domain/export-schema";
import {
  requireRecentAuthentication,
  type SensitiveActionSession,
} from "./require-recent-authentication";

export { AccountDeletionConfirmationError, AccountDeletionRaceError } from "../domain/export-schema";

export type DeleteAccountCommand = Readonly<{
  password: string | null;
  confirmationEmail: string;
  confirmationPhrase: "계정 삭제";
}>;

export type DeleteAccountContext = Readonly<{
  scope: UserScope;
  session: SensitiveActionSession & { sessionId: string };
  requestHeaders: Headers;
}>;

export const deleteAllRecordRows = async (
  transaction: Prisma.TransactionClient,
  scope: UserScope,
): Promise<void> => {
  const where = { userId: scope.userId };
  await transaction.recordRevision.deleteMany({ where });
  await transaction.sleepSession.deleteMany({ where });
  await transaction.phoneUsageEntry.deleteMany({ where });
  await transaction.caffeineEntry.deleteMany({ where });
  await transaction.alcoholEntry.deleteMany({ where });
  await transaction.mealEntry.deleteMany({ where });
  await transaction.exerciseEntry.deleteMany({ where });
  await transaction.wellnessEntry.deleteMany({ where });
};

export const createDeleteUserAccount = (dependencies: Readonly<{
  prisma: PrismaClient;
  clock: Clock;
  requireRecentAuthentication?: (session: SensitiveActionSession, password: string | null, headers: Headers, clock: Clock) => Promise<void>;
  beforeFinalUserDelete?: () => Promise<void>;
}>) => async (command: DeleteAccountCommand, context: DeleteAccountContext): Promise<void> => {
  const authenticate = dependencies.requireRecentAuthentication ?? requireRecentAuthentication;
  if (context.session.userId !== context.scope.userId) throw new AccountDeletionConfirmationError();
  await authenticate(context.session, command.password, context.requestHeaders, dependencies.clock);

  await dependencies.prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUniqueOrThrow({
      where: { id: context.scope.userId },
      select: { id: true, email: true },
    });
    if (user.email !== command.confirmationEmail || command.confirmationPhrase !== "계정 삭제") {
      throw new AccountDeletionConfirmationError();
    }

    const where = { userId: context.scope.userId };
    await transaction.session.deleteMany({ where: { ...where, NOT: { id: context.session.sessionId } } });
    await transaction.narration.deleteMany({ where });
    await transaction.impactFactor.deleteMany({ where: { analysisSnapshot: { userId: context.scope.userId } } });
    await transaction.analysisSnapshot.deleteMany({ where });
    await transaction.baselineSnapshot.deleteMany({ where });
    await transaction.planRevision.deleteMany({ where });
    await transaction.planDay.deleteMany({ where });
    await transaction.scheduleAdvice.deleteMany({ where });
    await transaction.sleepPlan.deleteMany({ where });
    await transaction.specialEvent.deleteMany({ where });
    await transaction.routineCompletion.deleteMany({ where });
    await transaction.careToolSession.deleteMany({ where });
    await deleteAllRecordRows(transaction, context.scope);
    await transaction.mutationReceipt.deleteMany({ where });
    await transaction.dailyLog.deleteMany({ where });
    await transaction.connection.deleteMany({ where });
    await transaction.userHabit.deleteMany({ where });
    await transaction.sleepGoal.deleteMany({ where });
    await transaction.userProfile.deleteMany({ where });
    await transaction.account.deleteMany({ where });
    await transaction.verification.deleteMany({ where: { identifier: { in: [user.id, user.email].filter((value): value is string => Boolean(value)) } } });
    await transaction.session.deleteMany({ where: { id: context.session.sessionId, userId: context.scope.userId } });
    await dependencies.beforeFinalUserDelete?.();
    const deleted = await transaction.user.deleteMany({ where: { id: context.scope.userId, email: user.email } });
    if (deleted.count !== 1) throw new AccountDeletionRaceError();
  });
};

export const deleteUserAccount = async (
  command: DeleteAccountCommand,
  context: DeleteAccountContext,
  dependencies: Readonly<{ prisma: PrismaClient; clock: Clock }>,
): Promise<void> => createDeleteUserAccount(dependencies)(command, context);
