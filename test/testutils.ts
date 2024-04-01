import { CstNode } from 'chevrotain'
import { workflowScriptLexer } from '../src/parser/lexer.js'
import { WorfkflowScriptParser } from '../src/parser/parser.js'
import { createVisitor } from '../src/parser/cstvisitor.js'
import {
  Expression,
  FunctionInvocation,
  ParenthesizedExpression,
  Primitive,
  Term,
  VariableReference,
} from '../src/ast/expressions.js'
import { Subworkflow } from '../src/ast/workflows.js'
import { SubworkflowAST, WorkflowStepAST } from '../src/ast/index.js'
import { StepNameGenerator } from '../src/ast/stepnames.js'

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

export function parseStatement(codeBlock: string): WorkflowStepAST[] {
  return parseOneRule(codeBlock, (p) => p.statement()) as WorkflowStepAST[]
}

export function parseSubworkflow(codeBlock: string): Subworkflow {
  const subworkflow = parseOneRule(codeBlock, (p) =>
    p.subworkflowDefinition(),
  ) as SubworkflowAST

  const stepNameGenerator = new StepNameGenerator()
  return subworkflow.withStepNames((x) => stepNameGenerator.generate(x))
}

export function primitiveEx(
  primitive:
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | null)[]
    | { [key: string]: string | number | boolean | null },
): Expression {
  return new Expression(new Term(primitive), [])
}

export function valueExpression(
  val:
    | Primitive
    | VariableReference
    | ParenthesizedExpression
    | FunctionInvocation,
): Expression {
  return new Expression(new Term(val), [])
}

export function renderASTStep(ast: WorkflowStepAST) {
  const stepNameGenerator = new StepNameGenerator()
  return ast.withStepNames((x) => stepNameGenerator.generate(x)).step.render()
}
