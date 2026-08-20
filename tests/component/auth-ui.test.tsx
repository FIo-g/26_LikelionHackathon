import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";
import { authClient } from "@/shared/auth/auth-client";

vi.mock("@/shared/auth/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}));

describe("Auth UI behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD" },
    } as never);
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: null,
      error: { code: "USER_ALREADY_EXISTS" },
    } as never);
  });

  it("passes the sanitized return path through the email sign-in request", async () => {
    render(<SignInForm returnTo="/record/caffeine?step=brand" />);

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "wrong-password",
        callbackURL: "/record/caffeine?step=brand",
      });
    });
  });

  it("starts a new account at the profile onboarding step", async () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "new-user@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "long-enough-password" } });
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));

    await waitFor(() => {
      expect(authClient.signUp.email).toHaveBeenCalledWith({
        email: "new-user@example.com",
        password: "long-enough-password",
        name: "new-user",
        callbackURL: "/onboarding/profile",
      });
    });
  });
});
