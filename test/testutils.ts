import { CstNode } from 'chevrotain'
import { workflowScriptLexer } from '../src/parser/lexer.js'
import { WorfkflowScriptParser } from '../src/parser/parser.js'
import { createVisitor } from '../src/parser/cstvisitor.js'
import { GWExpression, GWValue, Term } from '../src/ast/expressions.js'
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
    throw new Error('Lex error: ' + JSON.stringify(lexResult.errors))
  }
  if (parser.errors.length > 0) {
    throw new Error('Parsing error: ' + JSON.stringify(parser.errors))
  }

  return ast
}

export function parseEx(codeBlock: string): GWExpression {
  return parseOneRule(codeBlock, (p) => p.expression())
}

export function primitiveEx(primitive: GWValue): GWExpression {
  return new GWExpression(new Term(primitive), [])
}

export function parseStatement(codeBlock: string): NamedWorkflowStep {
  return parseOneRule(codeBlock, (p) => p.statement())
}

export function parseSubworkflow(codeBlock: string): Subworkflow {
  return parseOneRule(codeBlock, (p) => p.subworkflowDefinition())
}
