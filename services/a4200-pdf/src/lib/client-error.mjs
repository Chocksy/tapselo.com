/** User-facing request errors (4xx); never become 500. */
export class ClientError extends Error {
  constructor(status, message, nextStep, code = "CLIENT_ERROR") {
    super(message);
    this.name = "ClientError";
    this.status = status;
    this.message = message;
    this.nextStep = nextStep;
    this.code = code;
  }
}

export class JavaTimeoutError extends Error {
  constructor() {
    super("JAVA_TIMEOUT");
    this.name = "JavaTimeoutError";
  }
}
