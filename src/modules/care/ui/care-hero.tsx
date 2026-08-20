import type { PlanDayTarget } from "@/modules/planner/domain/types";
import styles from "./care.module.css";

export const CareHero = ({ planDay }: { planDay: PlanDayTarget | null }) => (
  <header className={styles.hero}>
    <p className={styles.eyebrow}>CARE / TONIGHT</p>
    <h1>Care</h1>
    <p>{planDay ? "오늘 밤을 위한 작은 준비를 차례대로 해볼까요." : "수면 목표를 입력하면 오늘의 준비 루틴을 만들어요."}</p>
  </header>
);
