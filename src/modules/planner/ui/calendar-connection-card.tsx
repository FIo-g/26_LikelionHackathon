import styles from "./plan.module.css";

export const CalendarConnectionCard = ({ availability }: { availability: "coming-soon" }) => (
  <section className={styles.connectionCard} aria-labelledby="calendar-connection-title">
    <span aria-hidden="true" className={styles.calendarConnectionMark}>캘</span>
    <div className={styles.connectionCopy}>
      <h2 id="calendar-connection-title">캘린더 연결</h2>
      <p>외부 캘린더 연결은 준비 중이에요. 지금도 주요 일정을 직접 입력해 조정 제안을 받을 수 있습니다.</p>
    </div>
    <div className={styles.connectionActions}>
      <button type="button" disabled={availability === "coming-soon"} aria-disabled="true">연동 준비 중</button>
      <a href="#major-event-form">직접 입력</a>
    </div>
  </section>
);
