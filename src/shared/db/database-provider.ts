export type DatabaseProvider = "sqlite" | "postgresql";

const isPostgresUrl = (url: string): boolean => url.startsWith("postgresql://") || url.startsWith("postgres://");

export const providerForUrl = (url: string): DatabaseProvider => {
  const raw = url.trim();

  if (!raw) {
    throw new Error("DATABASE_URL is required");
  }

  if (raw.startsWith("file:")) {
    return "sqlite";
  }

  if (isPostgresUrl(raw)) {
    return "postgresql";
  }

  throw new Error(`Unsupported DATABASE_URL provider for ${raw}`);
};

