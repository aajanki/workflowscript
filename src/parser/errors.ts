import { CstNode, CstNodeLocation } from 'chevrotain'

export class PostParsingError extends Error {
  location: CstNodeLocation | undefined

  constructor(message: string, location?: CstNodeLocation) {
    super(message)
    this.location = location
  }
}

export class InternalParsingError extends Error {
  cstNode: CstNode

  constructor(message: string, cstNode: CstNode) {
    super(`Bug in the WorkflowScript compiler! ${message}`)
    this.cstNode = cstNode
  }
}
