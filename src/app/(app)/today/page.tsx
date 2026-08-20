import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getTodayViewModel } from "@/modules/analysis/application/get-today-view-model";
import { TodayScreen } from "@/modules/analysis/ui/today-screen";

const TodayPage = async () => {
  const userScope = await requireUserScope();
  const viewModel = await getTodayViewModel(userScope);

  return (
    <TodayScreen viewModel={viewModel} />
  );
};

export default TodayPage;
