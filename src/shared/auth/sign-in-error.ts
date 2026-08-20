export type KoreanAuthErrorCode =
  | "INVALID_PASSWORD"
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD_OR_EMAIL"
  | "USER_NOT_FOUND"
  | "USER_EXISTS"
  | "SIGNUP_FAILED"
  | "SIGNIN_FAILED"
  | "UNKNOWN";

const MESSAGE_BY_CODE: Readonly<Record<KoreanAuthErrorCode, string>> = {
  INVALID_PASSWORD: "비밀번호가 일치하지 않습니다.",
  INVALID_EMAIL: "이메일 형식이 올바르지 않습니다.",
  INVALID_PASSWORD_OR_EMAIL: "이메일 또는 비밀번호를 확인해 주세요.",
  USER_NOT_FOUND: "등록된 계정이 없습니다.",
  USER_EXISTS: "이미 등록된 이메일입니다.",
  SIGNUP_FAILED: "회원가입 처리에 실패했습니다.",
  SIGNIN_FAILED: "로그인 처리에 실패했습니다.",
  UNKNOWN: "요청을 처리하지 못했습니다.",
};

export const toKoreanAuthError = (code?: KoreanAuthErrorCode): string => {
  return MESSAGE_BY_CODE[code ?? "UNKNOWN"] ?? MESSAGE_BY_CODE.UNKNOWN;
};
