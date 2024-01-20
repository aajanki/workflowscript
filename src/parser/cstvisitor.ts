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
  GWExpression,
  GWExpressionLiteral,
  GWParenthesizedExpression,
  GWTerm,
  GWValue,
  GWVariableName,
  GWVariableReference,
} from '../ast/variables.js'
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

    object(ctx: any): Record<string, GWExpression> {
      return Object.fromEntries(
        ctx.objectItem.map((x: CstNode) => this.visit(x)),
      )
    }

    objectItem(ctx: any): [string, GWExpression] {
      return [
        unescapeBackslashes(ctx.StringLiteral[0].image),
        this.visit(ctx.expression[0]).render(),
      ]
    }

    array(ctx: any): GWExpression[] {
      return ctx.expression.map((val: CstNode) => this.visit(val))
    }

    term(ctx: any): GWTerm {
      if (ctx.StringLiteral) {
        return unescapeBackslashes(ctx.StringLiteral[0].image)
      } else if (ctx.NumberLiteral) {
        return parseFloat(ctx.NumberLiteral[0].image)
      } else if (ctx.True) {
        return true
      } else if (ctx.False) {
        return false
      } else if (ctx.array) {
        const expressions: GWExpression[] = this.visit(ctx.array)
        return expressions.map((x) => x.render())
      } else if (ctx.object) {
        return this.visit(ctx.object)
      } else if (ctx.variableReference) {
        return this.visit(ctx.variableReference)
      } else if (ctx.parenthesizedExpression) {
        return this.visit(ctx.parenthesizedExpression)
      } else if (ctx.ExpressionLiteral) {
        return new GWExpressionLiteral(
          ctx.ExpressionLiteral[0].image.slice(2, -1),
        )
      } else {
        throw new Error('not implemented')
      }
    }

    expression(ctx: any): GWExpression {
      const terms: GWTerm[] = ctx.term.map((t: CstNode) => this.visit(t))
      const operators: string[] | undefined = ctx.BinaryOperator?.map(
        (op: IToken) => op.image,
      )
      const rest = operators?.map((op, i) => {
        return { operator: op, right: terms[i + 1] }
      })

      return new GWExpression(terms[0], rest ?? [])
    }

    parenthesizedExpression(ctx: any): GWParenthesizedExpression {
      return new GWParenthesizedExpression(this.visit(ctx.expression))
    }

    arrayOrArrayExpression(ctx: any): GWExpressionLiteral | GWValue[] {
      if (ctx.array) {
        const expressionArray: GWExpression[] = this.visit(ctx.array)
        return expressionArray.map((x) => x.render())
      } else if (ctx.ExpressionLiteral) {
        return new GWExpressionLiteral(
          ctx.ExpressionLiteral[0].image.slice(2, -1),
        )
      } else {
        throw new Error('not implemented')
      }
    }

    subscriptReference(ctx: any): string {
      const reference = ctx.Identifier[0].image
      const subscripts = (ctx.NumberLiteral ?? [])
        .concat(ctx.StringLiteral ?? [])
        .concat(ctx.ExpressionLiteral ?? [])
        .sort(compareStartOffsets)
        .map((x: IToken) => {
          if (
            x.tokenType.name === 'StringLiteral' ||
            x.tokenType.name === 'ExpressionLiteral'
          ) {
            return `[${x.image}]`
          } else if (x.tokenType.name === 'NumberLiteral') {
            const i = parseFloat(x.image)
            if (!Number.isInteger(i)) {
              throw new TypeError('Subscript must be an integer')
            }
            return `[${i}]`
          } else {
            throw new Error(`Unexpected subscription type: ${x.tokenType.name}`)
          }
        })
        .join('')

      return reference + subscripts
    }

    variableReference(ctx: any): GWVariableReference {
      const name: string = ctx.subscriptReference
        .map((ref: CstNode) => this.visit(ref) as string)
        .join('.')
      return new GWVariableReference(name)
    }

    assignmentStatement(ctx: any): NamedWorkflowStep {
      const ref: GWVariableReference = this.visit(ctx.variableReference)

      if (ctx.callExpression) {
        const { name, step } = this.visit(ctx.callExpression)

        // reconstruct the CallStep to supplement the result variable name
        return {
          name,
          step: new CallStep(step.call, step.args, ref.name),
        }
      } else {
        return {
          name: this.stepNameGenerator.generate('assign'),
          step: new AssignStep([
            [ref.name, this.visit(ctx.expression[0]).render()],
          ]),
        }
      }
    }

    functionName(ctx: any): string {
      const parts: string[] = ctx.Identifier.map((x: IToken) => x.image)
      return parts.join('.')
    }

    actualParameterList(ctx: any): GWArguments | undefined {
      if (ctx.Identifier) {
        const namedArgumentList = ctx.Identifier.map(
          (identifier: IToken, i: number) => {
            return [identifier.image, this.visit(ctx.expression[i]).render()]
          },
        )

        return Object.fromEntries(namedArgumentList)
      } else {
        return undefined
      }
    }

    callExpression(ctx: any): NamedWorkflowStep {
      return {
        name: this.stepNameGenerator.generate('call'),
        step: new CallStep(
          this.visit(ctx.functionName),
          this.visit(ctx.actualParameterList),
        ),
      }
    }

    ifStatement(ctx: any): NamedWorkflowStep {
      const branches: SwitchCondition[] = ctx.expression.map(
        (ex: CstNode, i: number) => {
          return new SwitchCondition(this.visit(ex).render(), {
            steps: this.visit(ctx.statementBlock[i]),
          })
        },
      )

      if (ctx.statementBlock.length > ctx.expression.length) {
        // The last branch is an else branch
        branches.push(
          new SwitchCondition(true, {
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
      const expression = this.visit(ctx.arrayOrArrayExpression) as
        | GWExpressionLiteral
        | GWValue[]

      return {
        name: this.stepNameGenerator.generate('for'),
        step: new ForStep(steps, loopVariable, expression),
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
      let shared: GWVariableName[] | undefined = undefined
      let exceptionPolicy: string | undefined = undefined
      let concurrencyLimit: number | undefined = undefined

      if (parameterNode) {
        const optionalParameters: GWArguments = this.visit(parameterNode) ?? {}
        for (const key in optionalParameters) {
          const val = optionalParameters[key]

          if (key === 'shared') {
            if (
              !(Array.isArray(val) && val.every((x) => typeof x === 'string'))
            ) {
              throw new Error(
                'The optional branch parameter "shared" must be an array of strings',
              )
            }

            shared = val as string[]
          } else if (key === 'concurrency_limit') {
            if (typeof val !== 'number') {
              throw new Error(
                'The optional branch parameter "concurrency_limit" must be an integer',
              )
            }

            concurrencyLimit = val
          } else if (key === 'exception_policy') {
            if (val !== 'continueAll') {
              throw new Error(
                'Invalid value for the optional branch parameter "exception_policy"',
              )
            }

            exceptionPolicy = val
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

    raiseStatement(ctx: any): NamedWorkflowStep {
      const ex: GWExpression = this.visit(ctx.expression)

      return {
        name: this.stepNameGenerator.generate('raise'),
        step: new RaiseStep(ex.render()),
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
      return {
        name: this.stepNameGenerator.generate('return'),
        step: new ReturnStep(this.visit(ctx.expression[0]).render()),
      }
    }

    statement(ctx: any): NamedWorkflowStep {
      if (ctx.assignmentStatement) {
        return this.visit(ctx.assignmentStatement[0])
      } else if (ctx.callExpression) {
        return this.visit(ctx.callExpression)
      } else if (ctx.ifStatement) {
        return this.visit(ctx.ifStatement[0])
      } else if (ctx.forStatement) {
        return this.visit(ctx.forStatement[0])
      } else if (ctx.parallelStatement) {
        return this.visit(ctx.parallelStatement[0])
      } else if (ctx.tryStatement) {
        return this.visit(ctx.tryStatement[0])
      } else if (ctx.raiseStatement) {
        return this.visit(ctx.raiseStatement[0])
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
      if (ctx.expression) {
        return { name, default: this.visit(ctx.expression).render() }
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

function compareStartOffsets(a: IToken, b: IToken) {
  return a.startOffset - b.startOffset
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
    if (policyParameters.policy instanceof GWExpressionLiteral) {
      return policyParameters.policy.expression
    } else {
      throw new Error('Invalid retry policy')
    }
  } else if (setEqual(actualKeys, customPolicyRequiredKays)) {
    // custom policy
    if (!(policyParameters.predicate instanceof GWExpressionLiteral)) {
      throw new Error('Invalid custom retry policy predicate')
    }

    if (typeof policyParameters.maxRetries !== 'number') {
      throw new Error('Invalid custom retry policy maxRetries')
    }

    if (typeof policyParameters.initialDelay !== 'number') {
      throw new Error('Invalid custom retry policy initalDelay')
    }

    if (typeof policyParameters.maxDelay !== 'number') {
      throw new Error('Invalid custom retry policy maxDelay')
    }

    if (typeof policyParameters.multiplier !== 'number') {
      throw new Error('Invalid custom retry policy multiplier')
    }

    return {
      predicate: policyParameters.predicate.expression,
      maxRetries: policyParameters.maxRetries,
      backoff: {
        initialDelay: policyParameters.initialDelay,
        maxDelay: policyParameters.maxDelay,
        multiplier: policyParameters.multiplier,
      },
    }
  } else {
    throw new Error('Invalid retry policy options')
  }
}
