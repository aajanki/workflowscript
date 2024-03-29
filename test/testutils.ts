import { CstNode } from 'chevrotain'
import { workflowScriptLexer } from '../src/parser/lexer.js'
import { WorfkflowScriptParser } from '../src/parser/parser.js'
import { createVisitor } from '../src/parser/cstvisitor.js'
import { Expression, Term } from '../src/ast/expressions.js'
import { NamedWorkflowStep } from '../src/ast/steps.js'
import { Subworkflow } from '../src/ast/workflows.js'

const parser = new WorfkflowScriptParser()
export const cstVisitor = createVisitor(parser)

function parseOneRule(
  codeBlock: string,
  parseRule: (parser: WorfkflowScriptParser) => CstNode,
) {
  const lexResult = workflowScriptLexer.tokenize(codeBlock)
  parser.input = lexResult.tokens

  const cst = parseRule(parser)
  const ast = cstVisitor.visit(cst)

  if (lexResult.errors.length > 0) {
    throw lexResult.errors[0]
  }
  if (parser.errors.length > 0) {
    throw parser.errors[0]
  }

  return ast
}

export function parseExpression(codeBlock: string): Expression {
  return parseOneRule(codeBlock, (p) => p.expression())
}

export function primitiveEx(
  primitive:
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | null)[],
): Expression {
  return new Expression(new Term(primitive), [])
}

export function parseStatement(codeBlock: string): NamedWorkflowStep {
  return parseOneRule(codeBlock, (p) => p.statement())
}

export function parseSubworkflow(codeBlock: string): Subworkflow {
  return parseOneRule(codeBlock, (p) => p.subworkflowDefinition())
}
