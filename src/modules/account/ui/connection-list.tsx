import type { AccountConnection } from "../application/ports";
import styles from "./account.module.css";

const statusText = (connection: AccountConnection): string => {
  if (connection.type === "manual") return "직접 입력 사용 중";
  if (connection.type === "wearable") return "웨어러블 연동 준비 중";
  if (connection.type === "phone") return "휴대폰 연동 준비 중";
  return "캘린더 연동 준비 중";
};

export const ConnectionList = ({ connections }: Readonly<{ connections: readonly AccountConnection[] }>) => <ul className={styles.connectionList}>{connections.map((connection) => <li key={connection.type}><div><strong>{connection.label}</strong><p>{statusText(connection)}</p></div><span>{connection.availability === "available" ? "직접 입력" : "준비 중"}</span></li>)}</ul>;
