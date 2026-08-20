const nextServerArguments = (port) => [
  "./node_modules/next/dist/bin/next",
  "dev",
  "--hostname",
  "127.0.0.1",
  "--port",
  port,
];

export const buildE2eServerArguments = (visualTest, port = "3000") => (
  visualTest
    ? ["--import", "./scripts/install-visual-clock-capability.mjs", ...nextServerArguments(port)]
    : nextServerArguments(port)
);
