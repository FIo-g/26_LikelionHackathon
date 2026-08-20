import Link from "next/link";
import { EntryPresence } from "@/modules/records/application/get-record-hub";

type RecordCategoryCardProps = Readonly<{
  category: string;
  presence: EntryPresence;
  inputMode: "manual";
  summary: string | null;
  href: string;
}>;

const actionLabel = (presence: EntryPresence): "추가" | "수정" => (
  presence === "empty" ? "추가" : "수정"
);

export const RecordCategoryCard = ({
  category,
  presence,
  inputMode,
  summary,
  href,
}: RecordCategoryCardProps) => {
  const isPhoneManual = category.includes("휴대폰") && inputMode === "manual";
  const statusLabel = isPhoneManual
    ? "직접 입력 사용 중"
    : presence === "empty"
      ? "미입력"
      : presence === "draft"
        ? "입력 중"
        : "완료";

  return (
    <article>
      <h3>{category}</h3>
      <p>{statusLabel}</p>
      <p>{summary ?? "아직 기록 없음"}</p>
      <Link href={href}>{actionLabel(presence)}</Link>
    </article>
  );
};
