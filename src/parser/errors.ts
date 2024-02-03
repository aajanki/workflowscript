export class PostParsingError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class InternalParsingError extends Error {
  constructor(message: string) {
    super(`Bug in the WorkflowScript compiler! ${message}`)
  }
}
