import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { DeviceConnectOption } from "@/modules/onboarding/ui/device-connect-option";

describe("Onboarding UI", () => {
  it("renders 4 progress items and current step label", () => {
    render(<OnboardingProgress currentStep={2} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("2단계, 현재 단계")).toBeVisible();
  });

  it("renders coming-soon wearable card as preparing", () => {
    render(
      <DeviceConnectOption
        type="wearable"
        availability="coming-soon"
        selected={false}
        state="unavailable"
      />,
    );

    expect(screen.getByText("준비 중")).toBeVisible();
    expect(screen.queryByText("연동 완료")).not.toBeInTheDocument();
  });
});

