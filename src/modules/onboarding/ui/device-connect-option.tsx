import type { ConnectionAvailability, ConnectionState } from "@/shared/connection/status";
import styles from "./onboarding.module.css";

type DeviceType = "wearable" | "phone";

type DeviceConnectOptionProps = Readonly<{
  type: DeviceType;
  availability: ConnectionAvailability;
  selected: boolean;
  state?: ConnectionState;
}>;

const TYPE_LABEL_BY_TYPE: Readonly<Record<DeviceType, string>> = {
  wearable: "워치 수면·운동",
  phone: "휴대폰 활동 시간",
};

const TYPE_DESCRIPTION_BY_TYPE: Readonly<Record<DeviceType, string>> = {
  wearable: "지원 기기를 연결하면 자동으로 채워져요.",
  phone: "지원되는 경우 오늘 수치를 자동으로 반영해요.",
};

const statusText = (props: DeviceConnectOptionProps): string => {
  if (props.availability === "coming-soon") {
    return "준비 중";
  }

  if (props.state === "complete" || props.selected) {
    return "연동 완료";
  }

  return props.state === "needs-input" ? "입력 필요" : "대기 중";
};

export const DeviceConnectOption = (props: DeviceConnectOptionProps) => {
  const isComingSoon = props.availability === "coming-soon";
  const status = statusText(props);

  return (
    <section className={`${styles.deviceCard} ${props.type === "phone" ? styles.deviceCardBlue : ""}`}>
      <div>
        <h3>{TYPE_LABEL_BY_TYPE[props.type]}</h3>
        <p>{TYPE_DESCRIPTION_BY_TYPE[props.type]}</p>
      </div>
      <button
        className={styles.deviceButton}
        type="button"
        disabled={isComingSoon}
        aria-disabled={isComingSoon ? "true" : "false"}
        aria-label={`${TYPE_LABEL_BY_TYPE[props.type]}: ${status}`}
      >
        {isComingSoon ? "준비 중" : "연결"}
      </button>
    </section>
  );
};
