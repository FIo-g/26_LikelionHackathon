import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/shared/auth/errors";

const { requireUserScope } = vi.hoisted(() => ({ requireUserScope: vi.fn() }));

vi.mock("@/shared/auth/require-user-scope", () => ({ requireUserScope }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateProfileAction } from "@/app/(app)/account/actions";

describe("Account server actions", () => {
  beforeEach(() => requireUserScope.mockReset());

  it("returns a controlled action error without touching account persistence when unauthenticated", async () => {
    requireUserScope.mockRejectedValue(new UnauthorizedError());
    const formData = new FormData();
    formData.set("nickname", "Alice");
    formData.set("timezone", "Asia/Seoul");

    await expect(updateProfileAction(undefined, formData)).resolves.toMatchObject({
      status: "error",
      fieldErrors: { _form: ["개인 정보를 저장하지 못했어요."] },
    });
  });
});
