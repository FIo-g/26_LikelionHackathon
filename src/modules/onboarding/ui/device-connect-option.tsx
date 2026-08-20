import type { ConnectionAvailability, ConnectionState } from "@/shared/connection/status";

type DeviceType = "wearable" | "phone";

type DeviceConnectOptionProps = Readonly<{
  type: DeviceType;
  availability: ConnectionAvailability;
  selected: boolean;
  state?: ConnectionState;
}>;

const TYPE_LABEL_BY_TYPE: Readonly<Record<DeviceType, string>> = {
  wearable: "웨어러블",
  phone: "휴대폰",
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
    <section>
      <h3>{TYPE_LABEL_BY_TYPE[props.type]} 연동</h3>
      <p>{status}</p>
      <button type="button" disabled={isComingSoon} aria-disabled={isComingSoon ? "true" : "false"}>
        {isComingSoon ? "준비 중" : "선택하기"}
      </button>
    </section>
  );
};

