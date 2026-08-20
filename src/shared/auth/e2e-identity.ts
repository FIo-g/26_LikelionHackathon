export type E2eIdentityInput = Readonly<{
  workerIndex: number;
  namespace: string;
}>;

export type E2eIdentity = Readonly<{
  id: string;
  email: string;
  namespace: string;
}>;

const namespacePattern = /^[a-z0-9][a-z0-9-]{0,31}$/;
const userIdPattern = /^e2e-[a-z0-9][a-z0-9-]{0,31}-w(?:0|[1-9][0-9]{0,2})$/;

export const e2eIdentity = ({ workerIndex, namespace }: E2eIdentityInput): E2eIdentity => {
  if (!Number.isSafeInteger(workerIndex) || workerIndex < 0 || workerIndex > 999) {
    throw new Error("INVALID_E2E_WORKER_INDEX");
  }
  if (!namespacePattern.test(namespace)) throw new Error("INVALID_E2E_NAMESPACE");

  const suffix = `${namespace}-w${workerIndex}`;
  return {
    id: `e2e-${suffix}`,
    email: `e2e+${suffix}@example.invalid`,
    namespace,
  };
};

export const isE2eUserId = (value: string): boolean => userIdPattern.test(value);
