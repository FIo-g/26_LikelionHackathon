import { safeReturnTo } from "@/shared/auth/entry-path";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { SignInForm } from "./sign-in-form";

type SearchParams = {
  returnTo?: string;
};

type SignInPageProps = {
  searchParams: Promise<SearchParams> | SearchParams;
};

const parseSearchParams = async (searchParams: Promise<SearchParams> | SearchParams) => {
  if (searchParams instanceof Promise) {
    return searchParams;
  }

  return searchParams;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolved = await parseSearchParams(searchParams);
  const safeReturnToPath = safeReturnTo(resolved?.returnTo ?? null);

  return (
    <AuthShell
      heading="반가워요"
      subtitle="오늘의 수면 준비를 이어가 볼까요?"
      footer={<><span>처음이신가요?</span><Link href="/sign-up">회원가입</Link></>}
    >
      <SignInForm returnTo={safeReturnToPath} />
    </AuthShell>
  );
}
