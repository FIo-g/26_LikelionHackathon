type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;

export function isReleaseValidationEnabled(environment?: ReleaseEnvironment): boolean;
export function assertReleaseEnvironment(environment?: ReleaseEnvironment): void;
