import styles from "./plan.module.css";

export const PlanResponsiveContent = ({ desktop, mobile }: { desktop: React.ReactNode; mobile: React.ReactNode }) => (
  <>
    <div className={styles.desktopPlanContent}>{desktop}</div>
    <div className={styles.mobilePlanContent}>{mobile}</div>
  </>
);
