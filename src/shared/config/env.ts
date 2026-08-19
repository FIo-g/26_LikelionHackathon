type EnvInput = Readonly<Record<string, string | undefined>>;

export const getRequiredEnv = (name: string, source: EnvInput = process.env): string => {
  const value = source[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

