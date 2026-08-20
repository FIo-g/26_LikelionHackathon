import Link from "next/link";
import styles from "./auth.module.css";

type AuthShellProps = {
  heading: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const AuthShell = ({ heading, children, footer }: AuthShellProps) => {
  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <h1 className={styles.heading}>{heading}</h1>
        {children}
        {footer ? <p className={styles.footer}>{footer}</p> : null}
        <p className={styles.help}>
          <Link href="/sign-in">로그인</Link> / <Link href="/sign-up">회원가입</Link>으로 이동
        </p>
      </section>
    </main>
  );
};
