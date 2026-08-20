import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";

const navigation = [
  { href: "/today", label: "Today" },
  { href: "/record", label: "Record" },
  { href: "/plan", label: "Plan" },
  { href: "/analyze", label: "Analyze" },
  { href: "/care", label: "Care" },
  { href: "/account", label: "Account" },
] as const;

const NavigationLinks = () => (
  <ul className={styles.navigationList}>
    {navigation.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}
  </ul>
);

export const AppShell = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className={styles.page}>
    <aside className={styles.desktopNavigation}>
      <Link className={styles.brand} href="/today">SLEEP LOOP</Link>
      <nav aria-label="데스크톱 주요 메뉴"><NavigationLinks /></nav>
    </aside>
    <div className={styles.content}>{children}</div>
    <nav aria-label="모바일 주요 메뉴" className={styles.mobileNavigation}><NavigationLinks /></nav>
  </div>
);
