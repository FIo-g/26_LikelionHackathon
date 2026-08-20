import { safeReturnTo } from "@/shared/auth/entry-path";
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
    <AuthShell heading="로그인">
      <SignInForm returnTo={safeReturnToPath} />
      <p>또는 바로 시작하려면 회원가입을 선택하세요.</p>
    </AuthShell>
  );
}
