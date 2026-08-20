export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class OnboardingIncompleteError extends Error {
  constructor(message = "Onboarding incomplete") {
    super(message);
    this.name = "OnboardingIncompleteError";
  }
}
