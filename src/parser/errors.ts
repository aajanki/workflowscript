import { CstNodeLocation } from 'chevrotain'

export class PostParsingError extends Error {
  location: CstNodeLocation | undefined

  constructor(message: string, location?: CstNodeLocation) {
    super(message)
    this.location = location
  }
}

export class InternalParsingError extends Error {
  constructor(message: string) {
    super(`Bug in the WorkflowScript compiler! ${message}`)
  }
}
