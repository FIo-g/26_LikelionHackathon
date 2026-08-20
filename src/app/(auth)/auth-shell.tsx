import Image from "next/image";
import styles from "./auth.module.css";

type AuthShellProps = {
  heading: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const AuthShell = ({ heading, subtitle, children, footer }: AuthShellProps) => {
  return (
    <main className={styles.wrapper}>
      <section className={styles.welcome} aria-hidden="true">
        <p className={styles.brand}>SLEEP LOOP</p>
        <h2>
          더 쉽게 잠들고,<br />
          더 나답게 깨어나는<br />
          수면 루틴
        </h2>
        <p className={styles.welcomeCopy}>
          생활 기록과 일정, 수면 데이터를 한 흐름으로 연결해<br />
          오늘 밤에 필요한 준비를 제안합니다.
        </p>
        <Image className={styles.welcomeGlow} src="/assets/lunar-rabbit/auth-welcome-glow.svg" alt="" width={420} height={420} priority />
        <div className={styles.welcomeStars}>
          <Image className={styles.starOne} src="/assets/lunar-rabbit/auth-star-small.svg" alt="" width={3} height={3} />
          <Image className={styles.starTwo} src="/assets/lunar-rabbit/auth-star-tiny.svg" alt="" width={2} height={2} />
          <Image className={styles.starThree} src="/assets/lunar-rabbit/auth-star-tiny.svg" alt="" width={2} height={2} />
          <Image className={styles.starFour} src="/assets/lunar-rabbit/auth-star-small.svg" alt="" width={3} height={3} />
          <Image className={styles.starFive} src="/assets/lunar-rabbit/auth-star-tiny.svg" alt="" width={2} height={2} />
          <Image className={styles.starSix} src="/assets/lunar-rabbit/auth-star-large.svg" alt="" width={12} height={12} />
          <Image className={styles.starSeven} src="/assets/lunar-rabbit/auth-star-medium.svg" alt="" width={8} height={8} />
          <Image className={styles.starEight} src="/assets/lunar-rabbit/auth-star-diamond.svg" alt="" width={10} height={10} />
          <Image className={styles.starNine} src="/assets/lunar-rabbit/auth-star-small.svg" alt="" width={3} height={3} />
        </div>
        <div className={styles.welcomeArtwork}>
          <Image className={styles.welcomeMoon} src="/assets/lunar-rabbit/auth-moon.svg" alt="" width={188} height={188} />
          <Image className={styles.welcomeMoonCutout} src="/assets/lunar-rabbit/auth-moon-cutout.svg" alt="" width={188} height={188} />
          <Image
            className={styles.welcomeRabbit}
            src="/assets/lunar-rabbit/care-rabbit.png"
            alt=""
            width={126}
            height={126}
          />
        </div>
      </section>
      <section className={styles.card}>
        <div className={styles.panelArtwork} aria-hidden="true">
          <Image className={styles.panelMoon} src="/assets/lunar-rabbit/auth-panel-moon.svg" alt="" width={72} height={72} />
          <Image
            className={styles.panelRabbit}
            src="/assets/lunar-rabbit/care-rabbit.png"
            alt=""
            width={60}
            height={60}
          />
        </div>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {children}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
        <p className={styles.privacy}>입력한 정보는 개인화된 수면 루틴을 만드는 데 사용됩니다.</p>
      </section>
    </main>
  );
};
