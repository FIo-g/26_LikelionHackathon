import { requireUserScope } from "@/shared/auth/require-user-scope";
import { getAnalyzeViewModel } from "@/modules/analysis/application/get-analyze-view-model";
import { AnalyzeScreen } from "@/modules/analysis/ui/analysis-report";

export default async function AnalyzePage() {
  const scope = await requireUserScope();
  const viewModel = await getAnalyzeViewModel(scope);

  return <AnalyzeScreen viewModel={viewModel} />;
}
