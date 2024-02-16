/* eslint-disable @typescript-eslint/no-unsafe-return */

import { CstNode, CstNodeLocation } from 'chevrotain'
import {
  AssignStep,
  NamedWorkflowStep,
  ReturnStep,
  WorkflowParameters,
  CallStep,
  SwitchCondition,
  SwitchStep,
  ParallelStep,
  StepName,
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
} from '../ast/expressions.js'
import { WorfkflowScriptParser } from './parser.js'
import { isRecord } from '../utils.js'
import { InternalParsingError, PostParsingError } from './errors.js'
import {
  ActualAnonymousParameterListCstChildren,
  ActualNamedParameterListCstChildren,
  ActualNamedParameterListCstNode,
  ActualParameterListCstChildren,
  ArrayCstChildren,
  AssignmentStatementCstChildren,
  BranchCstChildren,
  CallExpressionCstChildren,
  CallStatementCstChildren,
  ExpressionCstChildren,
  ForStatementCstChildren,
  FormalParameterCstChildren,
  FormalParameterListCstChildren,
  IfStatementCstChildren,
  LiteralCstChildren,
  ObjectCstChildren,
  ObjectItemCstChildren,
  ParallelStatementCstChildren,
  ParenthesizedExpressionCstChildren,
  ProgramCstChildren,
  QualifiedIdentifierCstChildren,
  ReturnStatementCstChildren,
  StatementBlockCstChildren,
  StatementCstChildren,
  SubscriptReferenceCstChildren,
  SubworkflowDefinitionCstChildren,
  TermCstChildren,
  ThrowStatementCstChildren,
  TryStatementCstChildren,
  VariableReferenceCstChildren,
} from './cst.js'

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

    object(ctx: ObjectCstChildren): Record<string, Expression> {
      if (ctx.objectItem) {
        return Object.fromEntries(ctx.objectItem.map((x) => this.visit(x)))
      } else {
        return {}
      }
    }

    objectItem(ctx: ObjectItemCstChildren): [string, Expression] {
      return [
        unescapeBackslashes(ctx.StringLiteral[0].image),
        this.visit(ctx.expression[0]),
      ]
    }

    array(ctx: ArrayCstChildren): Expression[] {
      if (ctx.expression) {
        return ctx.expression.map((val) => this.visit(val))
      } else {
        return []
      }
    }

    term(ctx: TermCstChildren): Term {
      let val
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
        val = this.visit(ctx.array) as Expression[]
      } else if (ctx.object) {
        val = this.visit(ctx.object) as Record<string, Expression>
      } else if (ctx.callExpression) {
        val = this.visit(ctx.callExpression) as FunctionInvocation
      } else if (ctx.variableReference) {
        val = this.visit(ctx.variableReference) as VariableReference
      } else if (ctx.parenthesizedExpression) {
        val = this.visit(ctx.parenthesizedExpression) as ParenthesizedExpression
      } else {
        throw new InternalParsingError('Unknown expression in "term"', ctx)
      }

      return new Term(val, op)
    }

    literal(ctx: LiteralCstChildren): string | number | boolean | null {
      const opString = ctx.UnaryOperator?.[0].image ?? ''

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
        throw new InternalParsingError('Unknown value in "literal"', ctx)
      }
    }

    expression(ctx: ExpressionCstChildren): Expression {
      const terms = ctx.term.map((x) => this.visit(x) as Term)
      const binaryOperators = ctx.BinaryOperator?.map((op) => op.image)
      const rest = binaryOperators?.map((op, i) => {
        return { binaryOperator: op, right: terms[i + 1] }
      })

      return new Expression(terms[0], rest ?? [])
    }

    parenthesizedExpression(
      ctx: ParenthesizedExpressionCstChildren,
    ): ParenthesizedExpression {
      return new ParenthesizedExpression(
        this.visit(ctx.expression) as Expression,
      )
    }

    subscriptReference(ctx: SubscriptReferenceCstChildren): string {
      const reference = ctx.Identifier[0].image
      const subscripts: string = (ctx.expression ?? [])
        .map((x) => {
          const expression = this.visit(x) as Expression

          if (expression.isLiteral()) {
            const value = expression.toLiteralValueOrLiteralExpression()
            if (typeof value === 'string') {
              return `[${JSON.stringify(value)}]`
            } else if (typeof value === 'number') {
              if (!Number.isInteger(value)) {
                let token = undefined
                const [term] = x.children.term
                if (
                  term?.children.NumberLiteral &&
                  term.children.NumberLiteral.length > 0
                ) {
                  token = term.children.NumberLiteral[0]
                }
                throw new PostParsingError("Subscript can't be a float", token)
              }
              return `[${value}]`
            } else {
              throw new PostParsingError(
                `Subscript must be a string, a number or an expression`,
                nodeSpan(x),
              )
            }
          } else {
            return `[${expression.toString()}]`
          }
        })
        .join('')

      return reference + subscripts
    }

    variableReference(ctx: VariableReferenceCstChildren): VariableReference {
      const name = ctx.subscriptReference
        .map((ref) => this.visit(ref) as string)
        .join('.')
      return new VariableReference(name)
    }

    assignmentStatement(
      ctx: AssignmentStatementCstChildren,
    ): NamedWorkflowStep {
      const ref = this.visit(ctx.variableReference) as VariableReference
      const ex = this.visit(ctx.expression[0]) as Expression

      return {
        name: this.stepNameGenerator.generate('assign'),
        step: new AssignStep([[ref.name, ex]]),
      }
    }

    qualifiedIdentifier(ctx: QualifiedIdentifierCstChildren): string {
      const parts = ctx.Identifier.map((x) => x.image)
      return parts.join('.')
    }

    actualNamedParameterList(
      ctx: ActualNamedParameterListCstChildren,
    ): WorkflowParameters | undefined {
      if (ctx.Identifier && ctx.expression) {
        const expr = ctx.expression
        const namedArgumentList = ctx.Identifier.map((identifier, i) => {
          return [identifier.image, this.visit(expr[i]) as Expression]
        })

        return Object.fromEntries(namedArgumentList)
      } else {
        return undefined
      }
    }

    actualAnonymousParameterList(
      ctx: ActualAnonymousParameterListCstChildren,
    ): Expression[] {
      if (ctx.expression) {
        return ctx.expression.map((x) => this.visit(x))
      } else {
        return []
      }
    }

    actualParameterList(
      ctx: ActualParameterListCstChildren,
    ): Expression[] | WorkflowParameters | undefined {
      if (ctx.actualNamedParameterList) {
        return this.visit(ctx.actualNamedParameterList)
      } else if (ctx.actualAnonymousParameterList) {
        return this.visit(ctx.actualAnonymousParameterList)
      } else {
        throw new InternalParsingError(
          'Unknown value in "actualParameterList"',
          ctx,
        )
      }
    }

    callExpression(ctx: CallExpressionCstChildren): FunctionInvocation {
      return new FunctionInvocation(
        this.visit(ctx.qualifiedIdentifier) as string,
        this.visit(ctx.actualAnonymousParameterList) as Expression[],
      )
    }

    callStatement(ctx: CallStatementCstChildren): NamedWorkflowStep {
      const functionName = this.visit(ctx.qualifiedIdentifier) as string
      const parameterList = this.visit(ctx.actualParameterList) as
        | Expression[]
        | WorkflowParameters
        | undefined
      const resultVariable = ctx.Identifier?.[0].image

      if (
        typeof resultVariable === 'undefined' &&
        (typeof parameterList === 'undefined' || parameterList.length === 0)
      ) {
        return {
          name: this.stepNameGenerator.generate('call'),
          step: new CallStep(functionName),
        }
      } else if (isRecord(parameterList)) {
        // named parameters => call step
        return {
          name: this.stepNameGenerator.generate('call'),
          step: new CallStep(functionName, parameterList, resultVariable),
        }
      } else {
        // anonymous parameters => assign step
        const variable: string = resultVariable ?? ''
        const ex = new Expression(
          new Term(new FunctionInvocation(functionName, parameterList ?? [])),
          [],
        )

        return {
          name: this.stepNameGenerator.generate('assign'),
          step: new AssignStep([[variable, ex]]),
        }
      }
    }

    ifStatement(ctx: IfStatementCstChildren): NamedWorkflowStep {
      const branches = ctx.expression.map((ex, i) => {
        return new SwitchCondition(this.visit(ex) as Expression, {
          steps: this.visit(ctx.statementBlock[i]) as NamedWorkflowStep[],
        })
      })

      if (ctx.statementBlock.length > ctx.expression.length) {
        // The last branch is an else branch
        branches.push(
          new SwitchCondition(new Expression(new Term(true), []), {
            steps: this.visit(
              ctx.statementBlock[ctx.statementBlock.length - 1],
            ) as NamedWorkflowStep[],
          }),
        )
      }

      return {
        name: this.stepNameGenerator.generate('switch'),
        step: new SwitchStep(branches),
      }
    }

    forStatement(ctx: ForStatementCstChildren): NamedWorkflowStep {
      const loopVariable = ctx.Identifier[0].image
      const steps = this.visit(ctx.statementBlock) as NamedWorkflowStep[]
      const listExpression = this.visit(ctx.expression) as Expression
      const listValue = listExpression.toLiteralValueOrLiteralExpression()

      if (
        !(
          Array.isArray(listValue) ||
          (!listExpression.isLiteral() && typeof listValue === 'string')
        )
      ) {
        throw new PostParsingError(
          'Value in a for loop is not iterable',
          nodeSpan(ctx.expression[0]),
        )
      }

      return {
        name: this.stepNameGenerator.generate('for'),
        step: new ForStep(steps, loopVariable, listExpression),
      }
    }

    branch(ctx: BranchCstChildren): NamedWorkflowStep[] {
      return this.visit(ctx.statementBlock)
    }

    parallelStatement(ctx: ParallelStatementCstChildren): NamedWorkflowStep {
      let nestedSteps: Record<StepName, StepsStep> | ForStep
      const { shared, concurrencyLimit, exceptionPolicy } =
        this.optionalBranchParameters(ctx.actualNamedParameterList)

      if (ctx.branch) {
        nestedSteps = Object.fromEntries(
          ctx.branch.map((branch, i) => {
            return [
              `branch${i + 1}`,
              new StepsStep(this.visit(branch) as NamedWorkflowStep[]),
            ]
          }),
        )
      } else if (ctx.forStatement) {
        const forStep = this.visit(ctx.forStatement) as NamedWorkflowStep
        nestedSteps = forStep.step as ForStep
      } else {
        throw new InternalParsingError(
          'Unknown value in "parallelStatement"',
          ctx,
        )
      }

      return {
        name: this.stepNameGenerator.generate('parallel'),
        step: new ParallelStep(
          nestedSteps,
          shared,
          concurrencyLimit,
          exceptionPolicy,
        ),
      }
    }

    optionalBranchParameters(
      parameterNode: ActualNamedParameterListCstNode[] | undefined,
    ): {
      shared: string[] | undefined
      concurrencyLimit: number | undefined
      exceptionPolicy: string | undefined
    } {
      let shared: VariableName[] | undefined = undefined
      let exceptionPolicy: string | undefined = undefined
      let concurrencyLimit: number | undefined = undefined

      if (parameterNode && parameterNode.length > 0) {
        const optionalParameters = (this.visit(parameterNode) ??
          {}) as WorkflowParameters
        for (const key in optionalParameters) {
          const val = optionalParameters[key]

          if (key === 'shared') {
            const maybeStringArray = extractStringArray(val)
            if (!maybeStringArray.success) {
              throw new PostParsingError(
                'The branch parameter "shared" must be an array of strings',
                findValueLocation(parameterNode[0], key),
              )
            }

            shared = maybeStringArray.value
          } else if (key === 'concurrency_limit') {
            concurrencyLimit = extractNumber(val)
            if (typeof concurrencyLimit === 'undefined') {
              throw new PostParsingError(
                'The branch parameter "concurrency_limit" must be an integer',
                findValueLocation(parameterNode[0], key),
              )
            }
          } else if (key === 'exception_policy') {
            exceptionPolicy = extractString(val)
            if (exceptionPolicy !== 'continueAll') {
              throw new PostParsingError(
                'Invalid value for the optional branch parameter "exception_policy"',
                findValueLocation(parameterNode[0], key),
              )
            }
          } else {
            throw new PostParsingError(
              `Unknown branch parameter: ${key}`,
              findKeyLocation(parameterNode[0], key),
            )
          }
        }
      }
      return { shared, concurrencyLimit, exceptionPolicy }
    }

    tryStatement(ctx: TryStatementCstChildren): NamedWorkflowStep {
      // must have either retry or catch block (or both)
      if (ctx.statementBlock.length <= 1 && !ctx.actualNamedParameterList) {
        throw new PostParsingError(
          'retry or catch expected in a try statement',
          ctx.Try?.[0],
        )
      }

      const trySteps = this.visit(ctx.statementBlock[0]) as NamedWorkflowStep[]
      const catchSteps =
        ctx.statementBlock.length > 1
          ? (this.visit(ctx.statementBlock[1]) as NamedWorkflowStep[])
          : []
      const errorVariable = ctx.Identifier?.[0].image
      let policy: string | CustomRetryPolicy | undefined = undefined

      if (ctx.actualNamedParameterList) {
        const policyParameters = this.visit(ctx.actualNamedParameterList) as
          | WorkflowParameters
          | undefined
        if (policyParameters) {
          policy = parseRetryPolicy(
            policyParameters,
            ctx.actualNamedParameterList[0],
          )
        } else {
          throw new PostParsingError(
            'Retry policy required',
            ctx.LeftParenthesis?.[0],
          )
        }
      }

      return {
        name: this.stepNameGenerator.generate('try'),
        step: new TryExceptStep(trySteps, catchSteps, policy, errorVariable),
      }
    }

    throwStatement(ctx: ThrowStatementCstChildren): NamedWorkflowStep {
      const ex = this.visit(ctx.expression) as Expression

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

    returnStatement(ctx: ReturnStatementCstChildren): NamedWorkflowStep {
      const step = ctx.expression
        ? new ReturnStep(this.visit(ctx.expression[0]) as Expression)
        : new ReturnStep()
      return {
        name: this.stepNameGenerator.generate('return'),
        step: step,
      }
    }

    statement(ctx: StatementCstChildren): NamedWorkflowStep {
      if (ctx.assignmentStatement) {
        return this.visit(ctx.assignmentStatement[0])
      } else if (ctx.callStatement) {
        return this.visit(ctx.callStatement[0])
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
        throw new InternalParsingError('Unknown value in "statement"', ctx)
      }
    }

    statementBlock(ctx: StatementBlockCstChildren): NamedWorkflowStep[] {
      if (ctx.statement) {
        const steps = ctx.statement.map(
          (statementCtx) => this.visit(statementCtx) as NamedWorkflowStep,
        )

        return combineConsecutiveAssignments(steps)
      } else {
        return []
      }
    }

    formalParameter(ctx: FormalParameterCstChildren): WorkflowParameter {
      const name = ctx.Identifier[0].image
      if (ctx.literal) {
        const value = this.visit(ctx.literal) as
          | string
          | number
          | boolean
          | null
        return { name, default: value }
      } else {
        return { name }
      }
    }

    formalParameterList(
      ctx: FormalParameterListCstChildren,
    ): WorkflowParameter[] {
      if (ctx.formalParameter) {
        return ctx.formalParameter.map((x) => this.visit(x))
      } else {
        return []
      }
    }

    subworkflowDefinition(ctx: SubworkflowDefinitionCstChildren): Subworkflow {
      const workflowName = ctx.Identifier[0].image
      const steps = this.visit(ctx.statementBlock) as NamedWorkflowStep[]
      const params = this.visit(ctx.formalParameterList) as WorkflowParameter[]

      return new Subworkflow(workflowName, steps, params)
    }

    program(ctx: ProgramCstChildren): WorkflowApp {
      let workflows: Subworkflow[]
      if (ctx.subworkflowDefinition) {
        workflows = ctx.subworkflowDefinition.map(
          (subctx) => this.visit(subctx) as Subworkflow,
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
  policyParameters: WorkflowParameters,
  node: ActualNamedParameterListCstNode,
): string | CustomRetryPolicy {
  const defaultPolicyRequiredKays = new Set(['policy'])
  const customPolicyRequiredKays = new Set([
    'predicate',
    'max_retries',
    'initial_delay',
    'max_delay',
    'multiplier',
  ])
  const actualKeys = new Set(Object.keys(policyParameters))

  if (setEqual(actualKeys, defaultPolicyRequiredKays)) {
    // default policy
    return policyParameters.policy.toString()
  } else if (setEqual(actualKeys, customPolicyRequiredKays)) {
    // custom policy
    const predicate = policyParameters.predicate.toString()
    if (!policyParameters.predicate.isFullyQualifiedName()) {
      throw new PostParsingError(
        '"predicate" in a retry policy must be a subworkflow name or http.default_retry_predicate or http.default_retry_predicate_non_idempotent',
        findValueLocation(node, 'predicate'),
      )
    }

    const maxRetries = extractNumber(policyParameters.max_retries)
    if (typeof maxRetries !== 'number') {
      throw new PostParsingError(
        '"max_retries" in a retry policy must be a number',
        findValueLocation(node, 'max_retries'),
      )
    }

    const initialDelay = extractNumber(policyParameters.initial_delay)
    if (typeof initialDelay !== 'number') {
      throw new PostParsingError(
        '"initalDelay" in a retry policy must be a number',
        findValueLocation(node, 'initial_delay'),
      )
    }

    const maxDelay = extractNumber(policyParameters.max_delay)
    if (typeof maxDelay !== 'number') {
      throw new PostParsingError(
        '"max_delay" in a retry policy must be a number',
        findValueLocation(node, 'max_delay'),
      )
    }

    const multiplier = extractNumber(policyParameters.multiplier)
    if (typeof multiplier !== 'number') {
      throw new PostParsingError(
        '"multiplier" in a retry policy must be a number',
        findValueLocation(node, 'multiplier'),
      )
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
    throw new PostParsingError(
      'Retry policy must define either "policy" or all of ["predicate", "max_retries", "initial_delay", "max_delay", "multiplier"]',
      nodeSpan(node),
    )
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

/**
 * Find the node location of a named key in an actualParameterList.
 */
function findKeyLocation(
  actualParameterList: ActualNamedParameterListCstNode,
  key: string,
): CstNodeLocation | undefined {
  // Locate the identifier token for key
  const identifier = actualParameterList.children.Identifier
  if (identifier) {
    const [identifierToken] = identifier.filter(
      (elem) => 'image' in elem && elem.image === key,
    )

    return identifierToken
  } else {
    return undefined
  }
}

/**
 * Find the node location of a value for key in an actualParameterList.
 */
function findValueLocation(
  actualParameterList: ActualNamedParameterListCstNode,
  key: string,
): CstNodeLocation | undefined {
  // Locate the identifier token for key
  const identifierLocation = findKeyLocation(actualParameterList, key)

  // Locate the location of the value token following the selected identifier token
  if (identifierLocation) {
    const identifierEndOffset = identifierLocation.endOffset ?? 0
    const expressions = actualParameterList.children.expression ?? []
    if (expressions.length > 0) {
      const valueLocations = expressions.map(nodeSpan)
      const candidateLocations = valueLocations.filter(
        (loc) => loc.startOffset >= identifierEndOffset,
      )
      candidateLocations.sort(
        (a, b) => (a.startColumn ?? 0) - (b.startColumn ?? 0),
      )

      return candidateLocations[0]
    }
  }

  return undefined
}

function nodeSpan(node: CstNode): CstNodeLocation {
  const current = {
    startOffset: NaN,
    startLine: undefined as number | undefined,
    startColumn: undefined as number | undefined,
    endOffset: undefined as number | undefined,
    endLine: undefined as number | undefined,
    endColumn: undefined as number | undefined,
  }

  for (const key of Object.keys(node.children)) {
    const children = node.children[key]

    for (const child of children) {
      const update = 'children' in child ? nodeSpan(child) : child

      if (
        isNaN(current.startOffset) ||
        (!isNaN(update.startOffset) && update.startOffset < current.startOffset)
      ) {
        current.startOffset = update.startOffset
        current.startLine = update.startLine
        current.startColumn = update.startColumn
      }

      if (
        typeof current.endOffset === 'undefined' ||
        (typeof update.endOffset !== 'undefined' &&
          update.endOffset > current.endOffset)
      ) {
        current.endOffset = update.endOffset
        current.endLine = update.endLine
        current.endColumn = update.endColumn
      }
    }
  }

  return current
}
