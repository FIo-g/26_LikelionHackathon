import { AsmrUnavailableCard } from "./asmr-unavailable-card";
import { BreathingGuide } from "./breathing-guide";
import { SleepGuide } from "./sleep-guide";
import { WhiteNoisePlayer } from "./white-noise-player";
import styles from "./care.module.css";

export const CareToolGrid = ({ localDate }: { localDate: string }) => (
  <section className={styles.toolGrid} aria-labelledby="care-tools-title">
    <div className={styles.toolHeading}>
      <h2 id="care-tools-title">지금 선택할 수 있는 도구</h2>
      <p className={styles.sectionCopy}>한 가지를 골라 짧게 시작해 보세요.</p>
    </div>
    <WhiteNoisePlayer localDate={localDate} />
    <AsmrUnavailableCard />
    <SleepGuide localDate={localDate} />
    <BreathingGuide localDate={localDate} />
  </section>
);
