import type { AnalysisRepository } from "@/modules/analysis/application/ports";
import type { Clock, UserScope } from "@/shared/domain/contracts";
import { wakeLocalDate } from "@/shared/time/local-date";
import { systemClock } from "@/shared/time/system-clock";
import { previewWhatIf, type WhatIfPreview } from "../domain/preview-what-if";

export type PreviewCaffeineWhatIfCommand = Readonly<{
  consumedAt: string;
  caffeineMg: number;
}>;

export const previewCaffeineWhatIf = async (
  scope: UserScope,
  analysisRepository: AnalysisRepository,
  command: PreviewCaffeineWhatIfCommand,
  dependencies: Readonly<{ clock?: Clock }> = {},
): Promise<WhatIfPreview> => {
  const clock = dependencies.clock ?? systemClock;
  const input = await analysisRepository.loadWindow(wakeLocalDate(clock.now(), scope.timezone), 14);
  return previewWhatIf({ input, caffeine: command });
};
