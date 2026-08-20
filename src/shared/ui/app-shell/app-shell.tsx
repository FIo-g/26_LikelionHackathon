import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";

const navigation = [
  { href: "/today", label: "Today", lunarLabel: "오늘", mobileLabel: "오늘" },
  { href: "/record", label: "Record", lunarLabel: "기록", mobileLabel: "기록" },
  { href: "/plan", label: "Plan", lunarLabel: "계획", mobileLabel: "계획" },
  { href: "/analyze", label: "Analyze", lunarLabel: "분석", mobileLabel: "분석" },
  { href: "/care", label: "Care", lunarLabel: "케어", mobileLabel: "케어" },
  { href: "/account", label: "Account", lunarLabel: "개인정보 · 목표", mobileLabel: "프로필" },
] as const;

const NavigationLinks = () => (
  <ul className={styles.navigationList}>
    {navigation.map((item) => (
      <li key={item.href}>
        <Link aria-label={item.label} href={item.href}>
          <span className={styles.desktopLabel}>{item.label}</span>
          <span aria-hidden="true" className={styles.lunarLabel}>{item.lunarLabel}</span>
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
      <div aria-hidden="true" className={styles.lunarSidebarArtwork}>
        <Image
          alt=""
          className={styles.lunarSidebarScene}
          height={127}
          loading="eager"
          src="/assets/lunar-rabbit/care-sidebar-scene.svg"
          width={162}
        />
        <Image
          alt=""
          className={styles.lunarSidebarRabbit}
          height={240}
          loading="eager"
          src="/assets/lunar-rabbit/care-sidebar-rabbit.png"
          width={240}
        />
      </div>
      <Link className={styles.lunarProfileLink} href="/account">
        <span aria-hidden="true" className={styles.lunarProfileMark}>토</span>
        <span>
          <strong>계정 설정</strong>
          <small>개인정보 · 목표</small>
        </span>
      </Link>
    </aside>
    <div className={styles.content}>{children}</div>
    <nav aria-label="모바일 주요 메뉴" className={styles.mobileNavigation}><NavigationLinks /></nav>
  </div>
);
