export class TimeInputError extends Error {
  readonly code = "NONEXISTENT_OR_AMBIGUOUS_TIME";

  constructor(message = "NONEXISTENT_OR_AMBIGUOUS_TIME") {
    super(message);
    this.name = "TimeInputError";
  }
}

export class JsonContractError extends Error {
  public readonly code: "JSON_TOO_LARGE" | "UNKNOWN_SCHEMA_VERSION" | "INVALID_JSON_VALUE";

  constructor(code: "JSON_TOO_LARGE" | "UNKNOWN_SCHEMA_VERSION" | "INVALID_JSON_VALUE") {
    super(code);
    this.name = "JsonContractError";
    this.code = code;
  }
}

