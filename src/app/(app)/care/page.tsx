import { getCareViewModel } from "@/modules/care/application/get-care-view-model";
import { CareScreen } from "@/modules/care/ui/care-screen";
import { requireUserScope } from "@/shared/auth/require-user-scope";

export default async function CarePage() {
  const scope = await requireUserScope();
  return <CareScreen viewModel={await getCareViewModel(scope)} />;
}
