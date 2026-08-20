import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";

const navigation = [
  { href: "/today", label: "Today", mobileLabel: "오늘" },
  { href: "/record", label: "Record", mobileLabel: "기록" },
  { href: "/plan", label: "Plan", mobileLabel: "계획" },
  { href: "/analyze", label: "Analyze", mobileLabel: "분석" },
  { href: "/care", label: "Care", mobileLabel: "케어" },
  { href: "/account", label: "Account", mobileLabel: "프로필" },
] as const;

const NavigationLinks = () => (
  <ul className={styles.navigationList}>
    {navigation.map((item) => (
      <li key={item.href}>
        <Link aria-label={item.label} href={item.href}>
          <span className={styles.desktopLabel}>{item.label}</span>
          <span aria-hidden="true" className={styles.mobileLabel}>{item.mobileLabel}</span>
        </Link>
      </li>
    ))}
  </ul>
);

export const AppShell = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className={styles.page}>
    <aside className={styles.desktopNavigation}>
      <Link className={styles.brand} href="/today">SLEEP LOOP</Link>
      <nav aria-label="데스크톱 주요 메뉴"><NavigationLinks /></nav>
      <div aria-hidden="true" className={styles.careSidebarArtwork}>
        <Image
          alt=""
          className={styles.careSidebarScene}
          height={127}
          src="/assets/lunar-rabbit/care-sidebar-scene.svg"
          width={162}
        />
        <Image
          alt=""
          className={styles.careSidebarRabbit}
          height={240}
          src="/assets/lunar-rabbit/care-sidebar-rabbit.png"
          width={240}
        />
      </div>
    </aside>
    <div className={styles.content}>{children}</div>
    <nav aria-label="모바일 주요 메뉴" className={styles.mobileNavigation}><NavigationLinks /></nav>
  </div>
);
