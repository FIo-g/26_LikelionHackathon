import { getPlanViewModel } from "@/modules/planner/application/get-plan-view-model";
import { createPrismaPlannerRepository } from "@/modules/planner/infrastructure/prisma-planner-repository";
import { PlanScreen } from "@/modules/planner/ui/plan-screen";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getPrismaClient } from "@/shared/db/prisma";
import type { TransactionClient } from "@/shared/db/transaction";

const PlanPage = async () => {
  const scope = await requireUserScope();
  const repository = createPrismaPlannerRepository(getPrismaClient() as TransactionClient, scope);
  const viewModel = await getPlanViewModel(repository, new Date(), scope.timezone);
  return <PlanScreen viewModel={viewModel} />;
};

export default PlanPage;
