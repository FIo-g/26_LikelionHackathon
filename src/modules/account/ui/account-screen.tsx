import Image from "next/image";
import type { AccountViewModel } from "../application/ports";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { ConnectionList } from "./connection-list";
import { DataManagementEntry } from "./data-management-entry";
import { ManualInputRules } from "./manual-input-rules";
import { ProfileForm } from "./profile-form";
import { SleepGoalCard } from "./sleep-goal-card";
import { FigmaMobileHeader } from "@/shared/ui/figma-mobile-header";
import styles from "./account.module.css";

const mobileConnectionLabel = (type: AccountViewModel["connections"][number]["type"], label: string): string => {
  if (type === "wearable") return "웨어러블 수면·운동";
  if (type === "phone") return "휴대폰 사용시간";
  return label;
};

const mobileConnectionState = (availability: AccountViewModel["connections"][number]["availability"]): string => (
  availability === "available" ? "직접 입력" : "준비 중"
);

export const AccountScreen = ({ viewModel }: Readonly<{ viewModel: AccountViewModel }>) => {
  const visibleConnections = viewModel.connections.filter((connection) => connection.type === "wearable" || connection.type === "phone");

  return (
    <main data-lunar-screen="account" className={styles.accountLayout}>
      <FigmaMobileHeader title="프로필 · 수면 목표" subtitle="나의 정보와 연결 상태를 한곳에서 관리해요." />
      <header className={styles.header}>
        <p className={styles.eyebrow}>ACCOUNT</p>
        <h1>계정 설정</h1>
        <p>내 정보와 수면 목표, 기록 방식의 상태를 확인하세요.</p>
      </header>
      <nav aria-label="계정 설정" className={styles.desktopTabs}>
        <a href="#profile">개인 정보</a><a href="#goal">수면 목표</a><a href="#connections">연결 관리</a><a href="#data">데이터 관리</a>
      </nav>
      <div className={styles.desktopDetails}>
        <section id="profile" className={styles.card}><h2>개인 정보</h2><ProfileForm idPrefix="desktop-profile" identity={viewModel.identity} profile={viewModel.profile} /></section>
        <section id="goal" className={styles.card}><h2>수면 목표</h2><SleepGoalCard idPrefix="desktop-goal" goal={viewModel.sleepGoal} /></section>
        <section id="connections" className={styles.card}><h2>연결 관리</h2><ConnectionList connections={viewModel.connections} /><ManualInputRules idPrefix="desktop-manual-rules" categories={viewModel.manualInputCategories} /></section>
      </div>
      <div className={styles.mobileDetails}>
        <section className={`${styles.summaryCard} ${styles.mobileProfileCard}`}>
          <Image alt="" height={64} src="/assets/lunar-rabbit/rabbit-face.png" width={64} />
          <div className={styles.mobileProfileCopy}>
            <h2>{viewModel.profile.nickname} · 기본 프로필</h2>
            <p>타임존 {viewModel.profile.timezone}</p>
          </div>
          <BottomSheet triggerLabel="개인 정보 수정" triggerVisualLabel="수정"><ProfileForm idPrefix="mobile-profile" identity={viewModel.identity} profile={viewModel.profile} /></BottomSheet>
        </section>
        <section className={`${styles.summaryCard} ${styles.mobileGoalCard}`}>
          <h2>수면 목표</h2>
          <p>{viewModel.sleepGoal.targetBedTime} → {viewModel.sleepGoal.targetWakeTime}</p>
          <BottomSheet triggerLabel="수면 목표 수정" triggerVisualLabel="목표 수정"><SleepGoalCard idPrefix="mobile-goal" goal={viewModel.sleepGoal} /></BottomSheet>
        </section>
        <section className={`${styles.summaryCard} ${styles.mobileConnectionCard}`}>
          <h2>연동 관리</h2>
          <ul className={styles.mobileConnectionList}>
            {visibleConnections.map((connection) => <li key={connection.type}><span aria-hidden="true" /><strong>{mobileConnectionLabel(connection.type, connection.label)}</strong><em>{mobileConnectionState(connection.availability)}</em></li>)}
          </ul>
          <p className={styles.mobileInputPill}>직접 입력</p>
          <BottomSheet triggerLabel="연결·직접 입력 보기" triggerVisualLabel="관리"><ConnectionList connections={viewModel.connections} /><ManualInputRules idPrefix="mobile-manual-rules" categories={viewModel.manualInputCategories} /></BottomSheet>
        </section>
        <aside className={styles.mobileManualNote}><strong>연동 없이도 직접 기록할 수 있어요</strong><p>수면은 기상 후 어젯밤 기준으로 입력합니다.</p></aside>
      </div>
      <div id="data"><DataManagementEntry reauth={viewModel.dataManagement} /></div>
    </main>
  );
};
