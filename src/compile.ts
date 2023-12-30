import { IToken } from 'chevrotain'
import { workflowScriptLexer } from '../src/lexer.js'
import { WorfkflowScriptParser, createVisitor } from '../src/parser.js'
import { WorkflowApp, toYAMLString } from './workflows.js'

export function compile(program: string): string {
  const tokens = tokenize(program)
  const ast = createAst(tokens)

  return toYAMLString(ast)
}

function tokenize(program: string): IToken[] {
  const lexResult = workflowScriptLexer.tokenize(program)

  if (lexResult.errors.length > 0) {
    throw new Error('Lex error: ' + JSON.stringify(lexResult.errors))
  }

  return lexResult.tokens
}

function createAst(tokens: IToken[]): WorkflowApp {
  const parser = new WorfkflowScriptParser()
  const visitor = createVisitor(parser)

  parser.input = tokens
  const cst = parser.program()
  const ast = visitor.visit(cst) as WorkflowApp

  // TODO: better error messages
  if (parser.errors.length > 0) {
    throw new Error('Parsing error: ' + JSON.stringify(parser.errors))
  }

  return ast
}
