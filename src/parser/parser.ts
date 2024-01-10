/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { CstNode, CstParser, IToken } from 'chevrotain'
import {
  Branch,
  Catch,
  Colon,
  Comma,
  Dot,
  Else,
  Equals,
  ExpressionLiteral,
  False,
  Identifier,
  If,
  LCurly,
  LParentheses,
  LSquare,
  Null,
  NumberLiteral,
  Parallel,
  RCurly,
  RParentheses,
  RSquare,
  Raise,
  Retry,
  Return,
  StringLiteral,
  True,
  Try,
  Workflow,
  tokens,
} from './lexer.js'
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
} from '../ast/steps.js'
import {
  Subworkflow,
  WorkflowApp,
  WorkflowParameter,
} from '../ast/workflows.js'
import { GWExpression, GWValue, GWVariableName } from '../ast/variables.js'

export class WorfkflowScriptParser extends CstParser {
  constructor() {
    super(tokens, {
      maxLookahead: 2,
    })

    this.performSelfAnalysis()
  }

  object = this.RULE('object', () => {
    this.CONSUME(LCurly)
    this.OPTION(() => {
      this.SUBRULE(this.objectItem)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE2(this.objectItem)
      })
    })
    this.CONSUME(RCurly)
  })

  objectItem = this.RULE('objectItem', () => {
    this.CONSUME(StringLiteral)
    this.CONSUME(Colon)
    this.SUBRULE(this.expression)
  })

  array = this.RULE('array', () => {
    this.CONSUME(LSquare)
    this.OPTION(() => {
      this.SUBRULE(this.expression)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE2(this.expression)
      })
    })
    this.CONSUME(RSquare)
  })

  expression = this.RULE('expression', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.object) },
      { ALT: () => this.SUBRULE(this.array) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Null) },
      { ALT: () => this.CONSUME(ExpressionLiteral) },
    ])
  })

  subscriptReference = this.RULE('subscriptReference', () => {
    this.CONSUME(Identifier)
    this.MANY(() => {
      this.CONSUME(LSquare)
      this.OR([
        { ALT: () => this.CONSUME(NumberLiteral) }, // TODO: should really be an integer literal
        { ALT: () => this.CONSUME(StringLiteral) },
        { ALT: () => this.CONSUME(ExpressionLiteral) },
      ])
      this.CONSUME(RSquare)
    })
  })

  variableReference = this.RULE('variableReference', () => {
    this.SUBRULE(this.subscriptReference)
    this.MANY(() => {
      this.CONSUME(Dot)
      this.SUBRULE2(this.subscriptReference)
    })
  })

  assignmentStatement = this.RULE('assignmentStatement', () => {
    this.SUBRULE(this.variableReference)
    this.CONSUME(Equals)
    this.OR([
      { ALT: () => this.SUBRULE2(this.expression) },
      { ALT: () => this.SUBRULE2(this.callExpression) },
    ])
  })

  functionName = this.RULE('functionName', () => {
    this.CONSUME(Identifier)
    this.MANY(() => {
      this.CONSUME(Dot)
      this.CONSUME2(Identifier)
    })
  })

  actualParameterList = this.RULE('actualParameterList', () => {
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME(Identifier)
        this.CONSUME(Equals)
        this.SUBRULE(this.expression)
      },
    })
  })

  callExpression = this.RULE('callExpression', () => {
    this.SUBRULE(this.functionName)
    this.CONSUME(LParentheses)
    this.SUBRULE(this.actualParameterList)
    this.CONSUME(RParentheses)
  })

  ifStatement = this.RULE('ifStatement', () => {
    this.CONSUME(If)
    this.CONSUME(LParentheses)
    this.SUBRULE(this.expression)
    this.CONSUME(RParentheses)
    this.CONSUME(LCurly)
    this.SUBRULE(this.statementBlock)
    this.CONSUME(RCurly)
    this.MANY(() => {
      this.CONSUME(Else)
      this.CONSUME2(If)
      this.CONSUME2(LParentheses)
      this.SUBRULE2(this.expression)
      this.CONSUME2(RParentheses)
      this.CONSUME2(LCurly)
      this.SUBRULE2(this.statementBlock)
      this.CONSUME2(RCurly)
    })
    this.OPTION(() => {
      this.CONSUME2(Else)
      this.CONSUME3(LCurly)
      this.SUBRULE3(this.statementBlock)
      this.CONSUME3(RCurly)
    })
  })

  tryStatement = this.RULE('tryStatement', () => {
    this.CONSUME(Try)
    this.CONSUME(LCurly)
    this.SUBRULE(this.statementBlock)
    this.CONSUME(RCurly)
    this.OPTION(() => {
      this.CONSUME(Retry)
      this.CONSUME(LParentheses)
      this.SUBRULE(this.actualParameterList)
      this.CONSUME(RParentheses)
    })
    this.OPTION2(() => {
      this.CONSUME(Catch)
      this.CONSUME2(LParentheses)
      this.CONSUME(Identifier)
      this.CONSUME2(RParentheses)
      this.CONSUME2(LCurly)
      this.SUBRULE2(this.statementBlock)
      this.CONSUME2(RCurly)
    })
    // Check in post-processing that at least either retry or catch is specified
  })

  raiseStatement = this.RULE('raiseStatement', () => {
    this.CONSUME(Raise)
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.object) },
      { ALT: () => this.CONSUME(ExpressionLiteral) },
    ])
  })

  parallelStatement = this.RULE('parallelStatement', () => {
    this.CONSUME(Parallel)
    this.OPTION(() => {
      this.CONSUME(LParentheses)
      this.SUBRULE(this.actualParameterList)
      this.CONSUME(RParentheses)
    })
    this.AT_LEAST_ONE(() => {
      this.CONSUME(Branch)
      this.CONSUME(LCurly)
      this.SUBRULE(this.statementBlock)
      this.CONSUME(RCurly)
    })
  })

  returnStatement = this.RULE('returnStatement', () => {
    this.CONSUME(Return)
    this.SUBRULE(this.expression)
  })

  statement = this.RULE('statement', () => {
    this.OR([
      {
        // TODO: restructure the common parts in function name/variable name
        // grammar so that backtracking is not required
        GATE: this.BACKTRACK(this.assignmentStatement),
        ALT: () => this.SUBRULE(this.assignmentStatement),
      },
      { ALT: () => this.SUBRULE(this.callExpression) }, // a function call without assigning the return value
      { ALT: () => this.SUBRULE(this.ifStatement) },
      { ALT: () => this.SUBRULE(this.parallelStatement) },
      { ALT: () => this.SUBRULE(this.tryStatement) },
      { ALT: () => this.SUBRULE(this.raiseStatement) },
      { ALT: () => this.SUBRULE(this.returnStatement) },
    ])
  })

  statementBlock = this.RULE('statementBlock', () => {
    this.MANY(() => {
      this.SUBRULE(this.statement)
    })
  })

  formalParameter = this.RULE('formalParameter', () => {
    this.CONSUME(Identifier)
    this.OPTION(() => {
      this.CONSUME(Equals)
      this.SUBRULE(this.expression)
    })
  })

  formalParameterList = this.RULE('formalParameterList', () => {
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.formalParameter)
      },
    })
  })

  subworkflowDefinition = this.RULE('subworkflowDefinition', () => {
    this.CONSUME(Workflow)
    this.CONSUME(Identifier)
    this.CONSUME(LParentheses)
    this.SUBRULE(this.formalParameterList)
    this.CONSUME(RParentheses)
    this.CONSUME(LCurly)
    this.SUBRULE(this.statementBlock)
    this.CONSUME(RCurly)
  })

  program = this.RULE('program', () => {
    this.MANY(() => {
      this.SUBRULE(this.subworkflowDefinition)
    })
  })
}

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

    object(ctx: any): Record<string, GWValue> {
      return Object.fromEntries(ctx.objectItem.map((x: any) => this.visit(x)))
    }

    objectItem(ctx: any): [string, GWValue] {
      return [
        unescapeBackslashes(ctx.StringLiteral[0].image),
        this.visit(ctx.expression[0]) as GWValue,
      ]
    }

    array(ctx: any): GWValue[] {
      return ctx.expression.map((val: any) => this.visit(val))
    }

    expression(ctx: any): GWValue {
      if (ctx.StringLiteral) {
        return unescapeBackslashes(ctx.StringLiteral[0].image)
      } else if (ctx.NumberLiteral) {
        return parseFloat(ctx.NumberLiteral[0].image)
      } else if (ctx.True) {
        return true
      } else if (ctx.False) {
        return false
      } else if (ctx.array) {
        return this.visit(ctx.array)
      } else if (ctx.object) {
        return this.visit(ctx.object)
      } else if (ctx.ExpressionLiteral) {
        return new GWExpression(ctx.ExpressionLiteral[0].image.slice(2, -1))
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

    variableReference(ctx: any): string {
      return ctx.subscriptReference
        .map((ref: CstNode) => this.visit(ref))
        .join('.')
    }

    assignmentStatement(ctx: any): NamedWorkflowStep {
      const varName = this.visit(ctx.variableReference)

      if (ctx.callExpression) {
        const { name, step } = this.visit(ctx.callExpression)

        // reconstruct the CallStep to supplement the result variable name
        return {
          name,
          step: new CallStep(step.call, step.args, varName),
        }
      } else {
        return {
          name: this.stepNameGenerator.generate('assign'),
          step: new AssignStep([[varName, this.visit(ctx.expression[0])]]),
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
            return [identifier.image, this.visit(ctx.expression[i])]
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
          return new SwitchCondition(this.visit(ex), {
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
      let value: GWValue
      if (ctx.StringLiteral) {
        value = unescapeBackslashes(ctx.StringLiteral[0].image)
      } else if (ctx.object) {
        value = this.visit(ctx.object)
      } else if (ctx.ExpressionLiteral) {
        value = new GWExpression(ctx.ExpressionLiteral[0].image.slice(2, -1))
      } else {
        throw new Error('Raise unexpected value')
      }

      return {
        name: this.stepNameGenerator.generate('raise'),
        step: new RaiseStep(value),
      }
    }

    returnStatement(ctx: any): NamedWorkflowStep {
      return {
        name: this.stepNameGenerator.generate('return'),
        step: new ReturnStep(this.visit(ctx.expression[0])),
      }
    }

    statement(ctx: any): NamedWorkflowStep {
      if (ctx.assignmentStatement) {
        return this.visit(ctx.assignmentStatement[0])
      } else if (ctx.callExpression) {
        return this.visit(ctx.callExpression)
      } else if (ctx.ifStatement) {
        return this.visit(ctx.ifStatement[0])
      } else if (ctx.parallelStatement) {
        return this.visit(ctx.parallelStatement[0])
      } else if (ctx.tryStatement) {
        return this.visit(ctx.tryStatement[0])
      } else if (ctx.raiseStatement) {
        return this.visit(ctx.raiseStatement[0])
      } else if (ctx.returnStatement) {
        return this.visit(ctx.returnStatement[0])
      } else {
        throw new Error('not implmeneted')
      }
    }

    statementBlock(ctx: any): NamedWorkflowStep[] {
      if (ctx.statement) {
        const steps: NamedWorkflowStep[] = ctx.statement.map(
          (statementCtx: any) => this.visit(statementCtx),
        )

        return combineConsecutiveAssignments(steps)
      } else {
        return []
      }
    }

    formalParameter(ctx: any): WorkflowParameter {
      const name = ctx.Identifier[0].image
      if (ctx.expression) {
        return { name, default: this.visit(ctx.expression) }
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
        workflows = ctx.subworkflowDefinition.map((subctx: any) =>
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

function unescapeBackslashes(str: string) {
  return JSON.parse(str)
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
    if (policyParameters.policy instanceof GWExpression) {
      return policyParameters.policy.expression
    } else {
      throw new Error('Invalid retry policy')
    }
  } else if (setEqual(actualKeys, customPolicyRequiredKays)) {
    // custom policy
    if (!(policyParameters.predicate instanceof GWExpression)) {
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
