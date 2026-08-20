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
        <div className={styles.welcomeArtwork}>
          <Image
            src="/assets/lunar-rabbit/care-sidebar-scene.svg"
            alt=""
            width={161}
            height={127}
            priority
          />
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
          <span />
          <Image
            src="/assets/lunar-rabbit/rabbit-face.png"
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
