import { BreathingGuide } from "./breathing-guide";
import { SleepGuide } from "./sleep-guide";
import { WhiteNoisePlayer } from "./white-noise-player";
import styles from "./care.module.css";

export const CareToolGrid = ({ localDate }: { localDate: string }) => <section className={styles.toolGrid} aria-labelledby="care-tools-title"><div className={styles.toolHeading}><p className={styles.eyebrow}>GENTLE TOOLS</p><h2 id="care-tools-title">잠들기 전 도구</h2></div><BreathingGuide localDate={localDate} /><WhiteNoisePlayer localDate={localDate} /><SleepGuide localDate={localDate} /></section>;
