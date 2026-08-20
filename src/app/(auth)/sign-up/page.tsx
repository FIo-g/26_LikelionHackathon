import { AuthShell } from "../auth-shell";
import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return (
    <AuthShell heading="회원가입">
      <SignUpForm />
      <p>기본 회원가입은 이메일과 비밀번호만 받습니다.</p>
    </AuthShell>
  );
}
