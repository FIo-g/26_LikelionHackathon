import styles from "./plan.module.css";

export const CalendarConnectionCard = ({ availability: _availability }: { availability: "coming-soon" }) => (
  <section className={styles.connectionCard} aria-labelledby="calendar-connection-title">
    <div>
      <p className={styles.eyebrow}>캘린더</p>
      <h2 id="calendar-connection-title">캘린더 연동 준비 중</h2>
      <p>지금은 중요한 일정을 직접 입력해 수면 준비 제안을 받을 수 있어요.</p>
    </div>
    <div className={styles.connectionActions}>
      <button type="button" disabled aria-disabled="true">연동 준비 중</button>
      <a href="#major-event-form">주요 일정 직접 입력</a>
    </div>
  </section>
);
