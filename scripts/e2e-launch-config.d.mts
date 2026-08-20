export const E2E_DATABASE_URL_ENV: "ADAPTIVE_SLEEP_E2E_DATABASE_URL";

export const isDedicatedE2eDatabaseUrl: (value: string) => boolean;

export const resolveE2eLaunchEnvironment: (source: Readonly<Record<string, string | undefined>>) => Record<string, string>;
