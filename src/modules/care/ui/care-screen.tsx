import type { CareViewModel } from "../application/get-care-view-model";
import { CareHero } from "./care-hero";
import { CareToolGrid } from "./care-tool-grid";
import { RoutineTimeline } from "./routine-timeline";
import { SyncSummary } from "./sync-summary";
import styles from "./care.module.css";

export const CareScreen = ({ viewModel }: { viewModel: CareViewModel }) => <main className={styles.page}><CareHero planDay={viewModel.planDay} /><SyncSummary availability="available" mode="manual" state={viewModel.inputState} /><RoutineTimeline localDate={viewModel.localDate} planDayId={viewModel.activePlanDayId} routineRevisionKey={viewModel.routineRevisionKey} steps={viewModel.routineSteps} timezone={viewModel.timezone} /><CareToolGrid localDate={viewModel.localDate} /></main>;
