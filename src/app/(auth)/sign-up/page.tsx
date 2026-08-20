import { AuthShell } from "../auth-shell";
import { SignUpForm } from "./sign-up-form";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <AuthShell
      heading="처음 만나요"
      subtitle="이메일로 계정을 만들고 수면 루틴을 시작해요."
      footer={<><span>이미 계정이 있나요?</span><Link href="/sign-in">로그인</Link></>}
    >
      <SignUpForm />
    </AuthShell>
  );
}
