import Image from "next/image";
import styles from "./figma-mobile-header.module.css";

type FigmaMobileHeaderProps = Readonly<{
  title: string;
  subtitle: string;
}>;

/**
 * Decorative counterpart for the semantic page header that remains in each
 * screen. Keeping the visual layer aria-hidden avoids duplicate headings for
 * assistive technology while allowing the Figma mobile composition to remain
 * independent from the desktop header.
 */
export const FigmaMobileHeader = ({ title, subtitle }: FigmaMobileHeaderProps) => (
  <div aria-hidden="true" className={styles.header}>
    <Image alt="" className={styles.art} height={154} priority src="/assets/lunar-rabbit/night-header.svg" width={390} />
    <div className={styles.copy}>
      <p className={styles.brand}>SLEEP LOOP</p>
      <p className={styles.title}>{title}</p>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  </div>
);
