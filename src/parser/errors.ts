import { CstNodeLocation } from 'chevrotain'

export class PostParsingError extends Error {
  location: CstNodeLocation | undefined

  constructor(message: string, location?: CstNodeLocation) {
    super(message)
    this.location = location
  }
}

export class InternalParsingError extends Error {
  context: unknown

  constructor(message: string, context: unknown) {
    super(`Bug in the WorkflowScript compiler! ${message}`)
    this.context = context
  }
}
