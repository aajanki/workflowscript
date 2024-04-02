/* eslint-disable @typescript-eslint/no-unsafe-return */

import { CstNode, CstNodeLocation } from 'chevrotain'
import {
  WorkflowParameters,
  StepName,
  CustomRetryPolicy,
} from '../ast/steps.js'
import { WorkflowParameter } from '../ast/workflows.js'
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
  BranchCstChildren,
  CallExpressionCstChildren,
  CallOrAssignmentStatementCstChildren,
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
import {
  AssignStepAST,
  CallStepAST,
  ForStepAST,
  NextStepAST,
  ParallelStepAST,
  RaiseStepAST,
  ReturnStepAST,
  StepsStepAST,
  SubworkflowAST,
  SwitchConditionAST,
  SwitchStepAST,
  TryStepAST,
  WorkflowAST,
  WorkflowStepAST,
} from '../ast/steps.js'

export function createVisitor(parserInstance: WorfkflowScriptParser) {
  const BaseWorkflowscriptCstVisitor =
    parserInstance.getBaseCstVisitorConstructor()

  class WorkflowscriptVisitor extends BaseWorkflowscriptCstVisitor {
    constructor() {
      super()
      this.validateVisitor()
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
      const op = ctx.UnaryOperator
        ? convertLogicalOperator(ctx.UnaryOperator[0].image)
        : undefined

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
      const opString = ctx.UnaryOperator
        ? convertLogicalOperator(ctx.UnaryOperator[0].image)
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
        throw new InternalParsingError('Unknown value in "literal"', ctx)
      }
    }

    expression(ctx: ExpressionCstChildren): Expression {
      const terms = ctx.term.map((x) => this.visit(x) as Term)
      const binaryOperators = ctx.BinaryOperator?.map((op) =>
        convertLogicalOperator(op.image),
      )
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

    callOrAssignmentStatement(
      ctx: CallOrAssignmentStatementCstChildren,
    ): WorkflowStepAST[] {
      const reference = this.visit(ctx.variableReference) as VariableReference
      let parameterList: Expression[] | WorkflowParameters | undefined =
        undefined
      if (ctx.actualParameterList) {
        parameterList = this.visit(ctx.actualParameterList) as
          | Expression[]
          | WorkflowParameters
          | undefined
      }

      if (ctx.Assignment && parameterList && ctx.qualifiedIdentifier) {
        // <variable> = <call>
        //
        // e.g.
        // results[0].my_variable = sys.get_env(name="MY_VARIABLE")
        // results[0].my_variable = map.get(myMap, "key1")
        const functionName = this.visit(ctx.qualifiedIdentifier) as string
        const resultVariable = reference.name

        if (isRecord(parameterList)) {
          // named parameters => call step (possibly with a temporary assignment)

          if (reference.isPlainIdentifier()) {
            return [
              new CallStepAST(functionName, parameterList, resultVariable),
            ]
          } else {
            // GCP Workflows call step does not support property or subscript accessors in
            // the result variable. We need to do this as two steps. First, assign the call
            // results to a temporary variable, and then assign the temporary variable to the
            // final destination.
            const tempVariable = '__temp'

            return [
              new CallStepAST(functionName, parameterList, tempVariable),
              new AssignStepAST([
                [
                  resultVariable,
                  new Expression(
                    new Term(new VariableReference(tempVariable)),
                    [],
                  ),
                ],
              ]),
            ]
          }
        } else {
          // anonymous parameters => assign step
          const variable: string = resultVariable ?? ''
          const ex = new Expression(
            new Term(new FunctionInvocation(functionName, parameterList ?? [])),
            [],
          )

          return [new AssignStepAST([[variable, ex]])]
        }
      } else if (ctx.Assignment && ctx.expression) {
        // <variable> = <expression_that_is_not_a_call_expression>
        //
        // e.g. results[0].my_variable = a + 1
        const ex = this.visit(ctx.expression[0]) as Expression

        return [new AssignStepAST([[reference.name, ex]])]
      } else if (typeof ctx.Assignment === 'undefined') {
        // <call_without_assignment>
        //
        // e.g. sys.get_env(name="MY_VARIABLE")

        // TODO check that functionName is a qualified identifier
        const functionName = reference.name

        if (isRecord(parameterList)) {
          // named parameters => call step
          return [new CallStepAST(functionName, parameterList)]
        } else if (Array.isArray(parameterList) && parameterList.length > 0) {
          // anonymous parameters => assign step
          const ex = new Expression(
            new Term(new FunctionInvocation(functionName, parameterList)),
            [],
          )

          return [new AssignStepAST([['', ex]])]
        } else {
          // no parameters => call step
          return [new CallStepAST(functionName)]
        }
      } else {
        throw new InternalParsingError(
          'Unknown parameter combination in "callOrAssignmentStatement"',
          ctx,
        )
      }
    }

    ifStatement(ctx: IfStatementCstChildren): WorkflowStepAST[] {
      const branches: SwitchConditionAST[] = ctx.expression.map((ex, i) => {
        return {
          condition: this.visit(ex) as Expression,
          steps: this.visit(ctx.statementBlock[i]) as WorkflowStepAST[],
        }
      })

      if (ctx.statementBlock.length > ctx.expression.length) {
        // The last branch is an else branch
        branches.push({
          condition: new Expression(new Term(true), []),
          steps: this.visit(
            ctx.statementBlock[ctx.statementBlock.length - 1],
          ) as WorkflowStepAST[],
        })
      }

      return [new SwitchStepAST(branches)]
    }

    forStatement(ctx: ForStatementCstChildren): WorkflowStepAST[] {
      const loopVariableName = ctx.Identifier[0].image
      const steps = this.visit(ctx.statementBlock) as WorkflowStepAST[]
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

      return [new ForStepAST(steps, loopVariableName, listExpression)]
    }

    branch(ctx: BranchCstChildren): WorkflowStepAST[] {
      return this.visit(ctx.statementBlock)
    }

    parallelStatement(ctx: ParallelStatementCstChildren): WorkflowStepAST[] {
      let nestedSteps: Record<StepName, StepsStepAST> | ForStepAST
      const { shared, concurrencyLimit, exceptionPolicy } =
        this.optionalBranchParameters(ctx.actualNamedParameterList)

      if (ctx.branch) {
        nestedSteps = Object.fromEntries(
          ctx.branch.map((branch, i) => {
            return [
              `branch${i + 1}`,
              new StepsStepAST(this.visit(branch) as WorkflowStepAST[]),
            ]
          }),
        )
      } else if (ctx.forStatement) {
        const forStep = this.visit(ctx.forStatement) as WorkflowStepAST[]

        if (forStep.length !== 1 || !(forStep[0] instanceof ForStepAST)) {
          throw new InternalParsingError(
            'Unexpected step type, expected a parallel for step',
            ctx,
          )
        }

        nestedSteps = forStep[0]
      } else {
        throw new InternalParsingError(
          'Unknown value in "parallelStatement"',
          ctx,
        )
      }

      return [
        new ParallelStepAST(
          nestedSteps,
          shared,
          concurrencyLimit,
          exceptionPolicy,
        ),
      ]
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

    tryStatement(ctx: TryStatementCstChildren): WorkflowStepAST[] {
      // must have either retry or catch block (or both)
      if (ctx.statementBlock.length <= 1 && !ctx.actualNamedParameterList) {
        throw new PostParsingError(
          'retry or catch expected in a try statement',
          ctx.Try?.[0],
        )
      }

      const trySteps = this.visit(ctx.statementBlock[0]) as WorkflowStepAST[]
      const catchSteps =
        ctx.statementBlock.length > 1
          ? (this.visit(ctx.statementBlock[1]) as WorkflowStepAST[])
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

      return [new TryStepAST(trySteps, catchSteps, policy, errorVariable)]
    }

    throwStatement(ctx: ThrowStatementCstChildren): WorkflowStepAST[] {
      return [new RaiseStepAST(this.visit(ctx.expression) as Expression)]
    }

    breakStatement(): WorkflowStepAST[] {
      return [new NextStepAST('break')]
    }

    continueStatement(): WorkflowStepAST[] {
      return [new NextStepAST('continue')]
    }

    returnStatement(ctx: ReturnStatementCstChildren): WorkflowStepAST[] {
      return [
        new ReturnStepAST(
          ctx.expression
            ? (this.visit(ctx.expression[0]) as Expression)
            : undefined,
        ),
      ]
    }

    statement(ctx: StatementCstChildren): WorkflowStepAST[] {
      if (ctx.callOrAssignmentStatement) {
        return this.visit(ctx.callOrAssignmentStatement[0])
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

    statementBlock(ctx: StatementBlockCstChildren): WorkflowStepAST[] {
      if (ctx.statement) {
        const steps = ctx.statement.flatMap(
          (statementCtx) => this.visit(statementCtx) as WorkflowStepAST[],
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

    subworkflowDefinition(
      ctx: SubworkflowDefinitionCstChildren,
    ): SubworkflowAST {
      const name = ctx.Identifier[0].image
      const steps = this.visit(ctx.statementBlock) as WorkflowStepAST[]
      const params = this.visit(ctx.formalParameterList) as WorkflowParameter[]

      return new SubworkflowAST(name, steps, params)
    }

    program(ctx: ProgramCstChildren): WorkflowAST {
      let workflows: SubworkflowAST[]
      if (ctx.subworkflowDefinition) {
        workflows = ctx.subworkflowDefinition.map(
          (subctx) => this.visit(subctx) as SubworkflowAST,
        )
      } else {
        workflows = []
      }

      return { subworkflows: workflows }
    }
  }

  return new WorkflowscriptVisitor()
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
  steps: WorkflowStepAST[],
): WorkflowStepAST[] {
  return steps.reduce((acc, current) => {
    if (current instanceof AssignStepAST && acc.length > 0) {
      const previousStep = acc[acc.length - 1]

      if (previousStep instanceof AssignStepAST) {
        const combinedAssignments = [
          ...previousStep.assignments,
          ...current.assignments,
        ]
        const combinedStep = new AssignStepAST(combinedAssignments)

        acc.pop()
        acc.push(combinedStep)
        return acc
      }
    }

    acc.push(current)
    return acc
  }, [] as WorkflowStepAST[])
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

/**
 * Convert logical operators from Workflowscript syntax (&&, ||, !) to GCP syntax (and, or, not).
 * Other operators remain unchanged.
 */
function convertLogicalOperator(operator: string): string {
  if (operator == '&&') {
    return 'and'
  } else if (operator == '||') {
    return 'or'
  } else if (operator == '!') {
    return 'not'
  } else {
    return operator
  }
}
