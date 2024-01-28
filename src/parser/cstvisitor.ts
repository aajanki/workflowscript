/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { CstNode, IToken } from 'chevrotain'
import {
  AssignStep,
  NamedWorkflowStep,
  ReturnStep,
  GWArguments,
  CallStep,
  SwitchCondition,
  SwitchStep,
  ParallelStep,
  GWStepName,
  StepsStep,
  TryExceptStep,
  RaiseStep,
  CustomRetryPolicy,
  ForStep,
  NextStep,
} from '../ast/steps.js'
import {
  Subworkflow,
  WorkflowApp,
  WorkflowParameter,
} from '../ast/workflows.js'
import {
  FunctionInvocation,
  Expression,
  ParenthesizedExpression,
  Term,
  VariableName,
  VariableReference,
  Primitive,
} from '../ast/expressions.js'
import { WorfkflowScriptParser } from './parser.js'

export function createVisitor(parserInstance: WorfkflowScriptParser) {
  const BaseWorkflowscriptCstVisitor =
    parserInstance.getBaseCstVisitorConstructor()

  class WorkflowscriptVisitor extends BaseWorkflowscriptCstVisitor {
    stepNameGenerator: StepNameGenerator

    constructor() {
      super()
      this.validateVisitor()
      this.stepNameGenerator = new StepNameGenerator()
    }

    reset() {
      this.stepNameGenerator.reset()
    }

    object(ctx: any): Record<string, Expression> {
      return Object.fromEntries(
        ctx.objectItem.map((x: CstNode) => this.visit(x)),
      )
    }

    objectItem(ctx: any): [string, Expression] {
      return [
        unescapeBackslashes(ctx.StringLiteral[0].image),
        this.visit(ctx.expression[0]),
      ]
    }

    array(ctx: any): Expression[] {
      return ctx.expression.map((val: CstNode) => this.visit(val))
    }

    term(ctx: any): Term {
      let val:
        | Primitive
        | VariableReference
        | ParenthesizedExpression
        | FunctionInvocation
      const op = ctx.UnaryOperator ? ctx.UnaryOperator[0].image : undefined

      if (ctx.StringLiteral) {
        val = unescapeBackslashes(ctx.StringLiteral[0].image)
      } else if (ctx.NumberLiteral) {
        val = parseFloat(ctx.NumberLiteral[0].image)
      } else if (ctx.True) {
        val = true
      } else if (ctx.False) {
        val = false
      } else if (ctx.Null) {
        val = null
      } else if (ctx.array) {
        val = this.visit(ctx.array)
      } else if (ctx.object) {
        val = this.visit(ctx.object)
      } else if (ctx.callExpression) {
        val = this.visit(ctx.callExpression)
      } else if (ctx.variableReference) {
        val = this.visit(ctx.variableReference)
      } else if (ctx.parenthesizedExpression) {
        val = this.visit(ctx.parenthesizedExpression)
      } else {
        throw new Error('not implemented')
      }

      return new Term(val, op)
    }

    literal(ctx: any): string | number | boolean | null {
      const opString: string = ctx.UnaryOperator
        ? ctx.UnaryOperator[0].image
        : ''

      if (ctx.StringLiteral) {
        return `${opString}${unescapeBackslashes(ctx.StringLiteral[0].image)}`
      } else if (ctx.NumberLiteral) {
        const val = parseFloat(ctx.NumberLiteral[0].image)
        if (opString === '-') {
          return -val
        } else {
          return val
        }
      } else if (ctx.True) {
        return true
      } else if (ctx.False) {
        return false
      } else if (ctx.Null) {
        return null
      } else {
        throw new Error('not implemented')
      }
    }

    expression(ctx: any): Expression {
      const terms: Term[] = ctx.term.map((t: CstNode) => this.visit(t))
      const binaryOperators: string[] | undefined = ctx.BinaryOperator?.map(
        (op: IToken) => op.image,
      )
      const rest = binaryOperators?.map((op, i) => {
        return { binaryOperator: op, right: terms[i + 1] }
      })

      return new Expression(terms[0], rest ?? [])
    }

    parenthesizedExpression(ctx: any): ParenthesizedExpression {
      return new ParenthesizedExpression(this.visit(ctx.expression))
    }

    subscriptReference(ctx: any): string {
      const reference = ctx.Identifier[0].image
      const subscripts: string = (ctx.expression ?? [])
        .map((x: CstNode) => {
          const expression: Expression = this.visit(x)

          if (expression.isLiteral()) {
            const value = expression.toLiteralValueOrLiteralExpression()
            if (typeof value === 'string') {
              return `[${JSON.stringify(value)}]`
            } else if (typeof value === 'number') {
              if (!Number.isInteger(value)) {
                throw new TypeError('Subscript must be an integer')
              }
              return `[${value}]`
            } else {
              throw new Error(`Unexpected subscription type: ${String(value)}`)
            }
          } else {
            return `[${expression.toString()}]`
          }
        })
        .join('')

      return reference + subscripts
    }

    variableReference(ctx: any): VariableReference {
      const name: string = ctx.subscriptReference
        .map((ref: CstNode) => this.visit(ref) as string)
        .join('.')
      return new VariableReference(name)
    }

    assignmentStatement(ctx: any): NamedWorkflowStep {
      const ref: VariableReference = this.visit(ctx.variableReference)
      const ex: Expression = this.visit(ctx.expression[0])

      return {
        name: this.stepNameGenerator.generate('assign'),
        step: new AssignStep([[ref.name, ex]]),
      }
    }

    functionName(ctx: any): string {
      const parts: string[] = ctx.Identifier.map((x: IToken) => x.image)
      return parts.join('.')
    }

    actualParameterList(ctx: any): GWArguments | undefined {
      if (ctx.Identifier) {
        const namedArgumentList: [string, Expression][] = ctx.Identifier.map(
          (identifier: IToken, i: number) => {
            return [identifier.image, this.visit(ctx.expression[i])]
          },
        )

        return Object.fromEntries(namedArgumentList)
      } else {
        return undefined
      }
    }

    actualAnonymousParameterList(ctx: any): Expression[] {
      if (ctx.expression) {
        return ctx.expression.map((x: CstNode) => this.visit(x))
      } else {
        return []
      }
    }

    callExpression(ctx: any): FunctionInvocation {
      return new FunctionInvocation(
        this.visit(ctx.functionName),
        this.visit(ctx.actualAnonymousParameterList),
      )
    }

    callStepStatement(ctx: any): NamedWorkflowStep {
      const ref: VariableReference = ctx.variableReference
        ? this.visit(ctx.variableReference)
        : undefined

      return {
        name: this.stepNameGenerator.generate('call'),
        step: new CallStep(
          this.visit(ctx.functionName),
          this.visit(ctx.actualParameterList),
          ref?.toString(),
        ),
      }
    }

    ifStatement(ctx: any): NamedWorkflowStep {
      const branches: SwitchCondition[] = ctx.expression.map(
        (ex: CstNode, i: number) => {
          return new SwitchCondition(this.visit(ex), {
            steps: this.visit(ctx.statementBlock[i]),
          })
        },
      )

      if (ctx.statementBlock.length > ctx.expression.length) {
        // The last branch is an else branch
        branches.push(
          new SwitchCondition(new Expression(new Term(true), []), {
            steps: this.visit(
              ctx.statementBlock[ctx.statementBlock.length - 1],
            ),
          }),
        )
      }

      return {
        name: this.stepNameGenerator.generate('switch'),
        step: new SwitchStep(branches),
      }
    }

    forStatement(ctx: any): NamedWorkflowStep {
      const loopVariable = ctx.Identifier[0].image
      const steps = this.visit(ctx.statementBlock)
      const listExpression: Expression = this.visit(ctx.expression)
      const listValue = listExpression.toLiteralValueOrLiteralExpression()

      if (
        !(
          Array.isArray(listValue) ||
          (!listExpression.isLiteral() && typeof listValue === 'string')
        )
      ) {
        throw new Error('Invalid value in a for loop')
      }

      return {
        name: this.stepNameGenerator.generate('for'),
        step: new ForStep(steps, loopVariable, listExpression),
      }
    }

    parallelStatement(ctx: any): NamedWorkflowStep {
      const branches: Record<GWStepName, StepsStep> = Object.fromEntries(
        ctx.statementBlock.map((statements: CstNode, i: number) => {
          return [`branch${i + 1}`, new StepsStep(this.visit(statements))]
        }),
      )

      const { shared, concurrencyLimit, exceptionPolicy } =
        this.optionalBranchParameters(ctx.actualParameterList)

      return {
        name: this.stepNameGenerator.generate('parallel'),
        step: new ParallelStep(
          branches,
          shared,
          concurrencyLimit,
          exceptionPolicy,
        ),
      }
    }

    optionalBranchParameters(parameterNode: CstNode | undefined): {
      shared: string[] | undefined
      concurrencyLimit: number | undefined
      exceptionPolicy: string | undefined
    } {
      let shared: VariableName[] | undefined = undefined
      let exceptionPolicy: string | undefined = undefined
      let concurrencyLimit: number | undefined = undefined

      if (parameterNode) {
        const optionalParameters: GWArguments = this.visit(parameterNode) ?? {}
        for (const key in optionalParameters) {
          const val = optionalParameters[key]

          if (key === 'shared') {
            const maybeStringArray = extractStringArray(val)
            if (!maybeStringArray.success) {
              throw new Error(
                'The optional branch parameter "shared" must be an array of strings',
              )
            }

            shared = maybeStringArray.value
          } else if (key === 'concurrency_limit') {
            concurrencyLimit = extractNumber(val)
            if (typeof concurrencyLimit === 'undefined') {
              throw new Error(
                'The optional branch parameter "concurrency_limit" must be an integer',
              )
            }
          } else if (key === 'exception_policy') {
            exceptionPolicy = extractString(val)
            if (exceptionPolicy !== 'continueAll') {
              throw new Error(
                'Invalid value for the optional branch parameter "exception_policy"',
              )
            }
          } else {
            throw new Error(`Unknown branch parameter: ${key}`)
          }
        }
      }
      return { shared, concurrencyLimit, exceptionPolicy }
    }

    tryStatement(ctx: any): NamedWorkflowStep {
      // must have either retry or catch block (or both)
      if (ctx.statementBlock.length <= 1 && !ctx.actualParameterList) {
        throw new Error('retry or catch expected in a try statement')
      }

      const trySteps = this.visit(ctx.statementBlock[0])
      const catchSteps =
        ctx.statementBlock.length > 1
          ? this.visit(ctx.statementBlock[1])
          : undefined
      const errorVariable = ctx.Identifier ? ctx.Identifier[0].image : undefined
      let policy: string | CustomRetryPolicy | undefined = undefined

      if (ctx.actualParameterList) {
        const policyParameters: GWArguments | undefined = this.visit(
          ctx.actualParameterList,
        )
        if (policyParameters) {
          policy = parseRetryPolicy(policyParameters)
        } else {
          throw new Error('Retry policy required')
        }
      }

      return {
        name: this.stepNameGenerator.generate('try'),
        step: new TryExceptStep(trySteps, catchSteps, policy, errorVariable),
      }
    }

    throwStatement(ctx: any): NamedWorkflowStep {
      const ex: Expression = this.visit(ctx.expression)

      return {
        name: this.stepNameGenerator.generate('raise'),
        step: new RaiseStep(ex),
      }
    }

    breakStatement(): NamedWorkflowStep {
      return {
        name: this.stepNameGenerator.generate('break'),
        step: new NextStep('break'),
      }
    }

    continueStatement(): NamedWorkflowStep {
      return {
        name: this.stepNameGenerator.generate('continue'),
        step: new NextStep('continue'),
      }
    }

    returnStatement(ctx: any): NamedWorkflowStep {
      const ex: Expression = this.visit(ctx.expression[0])
      return {
        name: this.stepNameGenerator.generate('return'),
        step: new ReturnStep(ex),
      }
    }

    statement(ctx: any): NamedWorkflowStep {
      if (ctx.assignmentStatement) {
        return this.visit(ctx.assignmentStatement[0])
      } else if (ctx.callStepStatement) {
        return this.visit(ctx.callStepStatement[0])
      } else if (ctx.ifStatement) {
        return this.visit(ctx.ifStatement[0])
      } else if (ctx.forStatement) {
        return this.visit(ctx.forStatement[0])
      } else if (ctx.parallelStatement) {
        return this.visit(ctx.parallelStatement[0])
      } else if (ctx.tryStatement) {
        return this.visit(ctx.tryStatement[0])
      } else if (ctx.throwStatement) {
        return this.visit(ctx.throwStatement[0])
      } else if (ctx.breakStatement) {
        return this.visit(ctx.breakStatement[0])
      } else if (ctx.continueStatement) {
        return this.visit(ctx.continueStatement[0])
      } else if (ctx.returnStatement) {
        return this.visit(ctx.returnStatement[0])
      } else {
        throw new Error('not implmeneted')
      }
    }

    statementBlock(ctx: any): NamedWorkflowStep[] {
      if (ctx.statement) {
        const steps: NamedWorkflowStep[] = ctx.statement.map(
          (statementCtx: CstNode) => this.visit(statementCtx),
        )

        return combineConsecutiveAssignments(steps)
      } else {
        return []
      }
    }

    formalParameter(ctx: any): WorkflowParameter {
      const name = ctx.Identifier[0].image
      if (ctx.literal) {
        const value: string | number | boolean | null = this.visit(ctx.literal)
        return { name, default: value }
      } else {
        return { name }
      }
    }

    formalParameterList(ctx: any): WorkflowParameter[] {
      if (ctx.formalParameter) {
        return ctx.formalParameter.map((x: CstNode) => this.visit(x))
      } else {
        return []
      }
    }

    subworkflowDefinition(ctx: any): Subworkflow {
      const workflowName: string = ctx.Identifier[0].image
      const steps: NamedWorkflowStep[] = this.visit(ctx.statementBlock)
      const params: WorkflowParameter[] = this.visit(ctx.formalParameterList)

      return new Subworkflow(workflowName, steps, params)
    }

    program(ctx: any): WorkflowApp {
      let workflows: Subworkflow[]
      if (ctx.subworkflowDefinition) {
        workflows = ctx.subworkflowDefinition.map((subctx: CstNode) =>
          this.visit(subctx),
        )
      } else {
        workflows = []
      }

      return new WorkflowApp(workflows)
    }
  }

  return new WorkflowscriptVisitor()
}

class StepNameGenerator {
  private counters: Map<string, number>

  constructor() {
    this.counters = new Map<string, number>()
  }

  generate(prefix: string): string {
    const i = this.counters.get(prefix) ?? 1

    this.counters.set(prefix, i + 1)

    return `${prefix}${i}`
  }

  reset() {
    this.counters = new Map<string, number>()
  }
}

function unescapeBackslashes(str: string): string {
  return JSON.parse(str) as string
}

/**
 * Combine consecutive assignment steps into one.
 *
 * Optimization that reduces the number of steps.
 */
function combineConsecutiveAssignments(
  steps: NamedWorkflowStep[],
): NamedWorkflowStep[] {
  return steps.reduce((acc, current) => {
    if (
      current.step instanceof AssignStep &&
      acc.length > 0 &&
      acc[acc.length - 1].step instanceof AssignStep
    ) {
      const previousStep = acc[acc.length - 1]
      const previousAssignments = (previousStep.step as AssignStep).assignments
      const combinedAssignments = [
        ...previousAssignments,
        ...current.step.assignments,
      ]

      const combinedStep = {
        name: previousStep.name,
        step: new AssignStep(combinedAssignments),
      }

      acc.pop()
      acc.push(combinedStep)
      return acc
    } else {
      acc.push(current)
      return acc
    }
  }, [] as NamedWorkflowStep[])
}

function setEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x))
}

function parseRetryPolicy(
  policyParameters: GWArguments,
): string | CustomRetryPolicy {
  const defaultPolicyRequiredKays = new Set(['policy'])
  const customPolicyRequiredKays = new Set([
    'predicate',
    'maxRetries',
    'initialDelay',
    'maxDelay',
    'multiplier',
  ])
  const actualKeys = new Set(Object.keys(policyParameters))

  if (setEqual(actualKeys, defaultPolicyRequiredKays)) {
    // default policy
    return policyParameters.policy.toString()
  } else if (setEqual(actualKeys, customPolicyRequiredKays)) {
    // custom policy
    const predicate = policyParameters.predicate.toString()

    const maxRetries = extractNumber(policyParameters.maxRetries)
    if (typeof maxRetries !== 'number') {
      throw new Error('Invalid custom retry policy maxRetries')
    }

    const initialDelay = extractNumber(policyParameters.initialDelay)
    if (typeof initialDelay !== 'number') {
      throw new Error('Invalid custom retry policy initalDelay')
    }

    const maxDelay = extractNumber(policyParameters.maxDelay)
    if (typeof maxDelay !== 'number') {
      throw new Error('Invalid custom retry policy maxDelay')
    }

    const multiplier = extractNumber(policyParameters.multiplier)
    if (typeof multiplier !== 'number') {
      throw new Error('Invalid custom retry policy multiplier')
    }

    return {
      predicate: predicate,
      maxRetries: maxRetries,
      backoff: {
        initialDelay: initialDelay,
        maxDelay: maxDelay,
        multiplier: multiplier,
      },
    }
  } else {
    throw new Error('Invalid retry policy options')
  }
}

function extractStringArray(
  ex: Expression,
): { success: false } | { success: true; value: string[] } {
  if (!ex.isLiteral()) {
    return { success: false }
  }

  const literal = ex.toLiteralValueOrLiteralExpression()
  if (!Array.isArray(literal)) {
    return { success: false }
  }

  const res: string[] = []
  for (const val of literal) {
    if (typeof val === 'string') {
      res.push(val)
    } else {
      return { success: false }
    }
  }

  return { success: true, value: res }
}

function extractNumber(ex: Expression): number | undefined {
  if (ex.rest.length === 0 && typeof ex.left.value === 'number') {
    return ex.left.value
  } else {
    return undefined
  }
}

function extractString(ex: Expression): string | undefined {
  if (ex.rest.length === 0 && typeof ex.left.value === 'string') {
    return ex.left.value
  } else {
    return undefined
  }
}
