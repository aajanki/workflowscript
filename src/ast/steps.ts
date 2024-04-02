import { InternalParsingError } from '../parser/errors.js'
import { Expression, VariableName } from './expressions.js'
import { Subworkflow, WorkflowParameter } from './workflows.js'

export type StepName = string
export type VariableAssignment = readonly [VariableName, Expression]
export type WorkflowParameters = Record<VariableName, Expression>

export interface WorkflowAST {
  readonly subworkflows: SubworkflowAST[]
}

export class SubworkflowAST {
  readonly name: string
  readonly steps: WorkflowStepAST[]
  readonly params?: WorkflowParameter[]

  constructor(
    name: string,
    steps: WorkflowStepAST[],
    params?: WorkflowParameter[],
  ) {
    this.name = name
    this.steps = steps
    this.params = params
  }

  withStepNames(generate: (prefix: string) => string): Subworkflow {
    const steps = this.steps.map((step) => step.withStepNames(generate))

    return new Subworkflow(this.name, steps, this.params)
  }
}

/**
 * A workflow step before step names have been assigned.
 */
export interface WorkflowStepAST {
  readonly tag: string

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2
}

/**
 * A workflow step after names have been generated for the nested steps.
 */
export interface WorkflowStepASTWithNamedNested {
  readonly tag: string

  render(): object
  nestedSteps(): NamedWorkflowStep2[]
}

export interface NamedWorkflowStep2 {
  name: StepName
  step: WorkflowStepASTWithNamedNested
}

// https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step
export class AssignStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'assign'
  readonly assignments: VariableAssignment[]

  constructor(assignments: VariableAssignment[]) {
    this.assignments = assignments
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    return {
      name: generate('assign'),
      step: this,
    }
  }

  render(): object {
    return {
      assign: this.assignments.map(([key, val]) => {
        return { [key]: val.toLiteralValueOrLiteralExpression() }
      }),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/calls
export class CallStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'call'
  readonly call: string
  readonly args?: WorkflowParameters
  readonly result?: string

  constructor(call: string, args?: WorkflowParameters, result?: string) {
    this.call = call
    this.args = args
    this.result = result
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    return {
      name: generate('call'),
      step: this,
    }
  }

  render(): object {
    let args:
      | Record<string, null | string | number | boolean | object>
      | undefined = undefined
    if (this.args) {
      args = Object.fromEntries(
        Object.entries(this.args).map(([k, v]) => {
          return [k, v.toLiteralValueOrLiteralExpression()]
        }),
      )
    }

    return {
      call: this.call,
      ...(args && { args }),
      ...(this.result && { result: this.result }),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/iteration
export class ForStepAST implements WorkflowStepAST {
  readonly tag = 'for'
  readonly steps: WorkflowStepAST[]
  readonly loopVariableName: VariableName
  readonly indexVariableName?: VariableName
  readonly listExpression: Expression
  readonly rangeStart?: number
  readonly rangeEnd?: number

  constructor(
    steps: WorkflowStepAST[],
    loopVariableName: VariableName,
    listExpression: Expression,
    indexVariable?: VariableName,
    rangeStart?: number,
    rangeEnd?: number,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
    this.indexVariableName = indexVariable
    this.rangeStart = rangeStart
    this.rangeEnd = rangeEnd
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    const namedSteps = this.steps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: generate('for'),
      step: new ForStepASTNamed(
        namedSteps,
        this.loopVariableName,
        this.listExpression,
      ),
    }
  }
}

export class ForStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'for'
  readonly steps: NamedWorkflowStep2[]
  readonly loopVariableName: VariableName
  readonly indexVariableName?: VariableName
  readonly listExpression?: Expression
  readonly rangeStart?: number
  readonly rangeEnd?: number

  constructor(
    steps: NamedWorkflowStep2[],
    loopVariableName: VariableName,
    listExpression?: Expression,
    indexVariable?: VariableName,
    rangeStart?: number,
    rangeEnd?: number,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
    this.indexVariableName = indexVariable
    this.rangeStart = rangeStart
    this.rangeEnd = rangeEnd
  }

  render(): object {
    return {
      for: this.renderBody(),
    }
  }

  renderBody(): object {
    let range: (number | undefined)[] | undefined
    let inValue: null | string | number | boolean | object | undefined
    if (typeof this.listExpression === 'undefined') {
      range = [this.rangeStart, this.rangeEnd]
      inValue = undefined
    } else {
      inValue = this.listExpression.toLiteralValueOrLiteralExpression()
      range = undefined
    }

    return {
      value: this.loopVariableName,
      ...(this.indexVariableName && { index: this.indexVariableName }),
      ...(inValue && { in: inValue }),
      ...(range && { range }),
      steps: renderSteps(this.steps),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return this.steps
  }
}

export class NextStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'next'
  readonly target: string

  constructor(target: string) {
    this.target = target
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    return {
      name: generate('next'),
      step: this,
    }
  }

  render(): object {
    return {
      next: this.target,
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps
export class ParallelStepAST implements WorkflowStepAST {
  readonly tag = 'parallel'
  readonly steps: Record<StepName, StepsStepAST> | ForStepAST
  readonly shared?: VariableName[]
  readonly concurrencyLimit?: number
  readonly exceptionPolicy?: string

  constructor(
    steps: Record<StepName, StepsStepAST> | ForStepAST,
    shared?: VariableName[],
    concurrencyLimit?: number,
    exceptionPolicy?: string,
  ) {
    this.steps = steps
    this.shared = shared
    this.concurrencyLimit = concurrencyLimit
    this.exceptionPolicy = exceptionPolicy
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    let steps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed
    if (this.steps instanceof ForStepAST) {
      const forStep = this.steps.withStepNames(generate).step

      if (!(forStep instanceof ForStepASTNamed)) {
        throw new InternalParsingError('Encountered unexpected step', undefined)
      }

      steps = forStep
    } else {
      steps = Object.fromEntries(
        Object.entries(this.steps).map(([name, astStep]) => {
          const namedSteps = astStep.steps.map((x) => x.withStepNames(generate))
          return [name, new StepsStepASTNamed(namedSteps)]
        }),
      )
    }

    return {
      name: generate('parallel'),
      step: new ParallelStepASTNamed(
        steps,
        this.shared,
        this.concurrencyLimit,
        this.exceptionPolicy,
      ),
    }
  }
}

export class ParallelStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'parallel'
  readonly branches?: NamedWorkflowStep2[] // Either steps for each branch
  readonly forStep?: ForStepASTNamed // ... or a parallel for
  readonly shared?: VariableName[]
  readonly concurrenceLimit?: number
  readonly exceptionPolicy?: string

  constructor(
    steps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed,
    shared?: VariableName[],
    concurrencyLimit?: number,
    exceptionPolicy?: string,
  ) {
    this.shared = shared
    this.concurrenceLimit = concurrencyLimit
    this.exceptionPolicy = exceptionPolicy

    if (steps instanceof ForStepASTNamed) {
      this.forStep = steps
    } else {
      this.branches = Object.entries(steps).map((x) => {
        return { name: x[0], step: x[1] }
      })
    }
  }

  render(): object {
    return {
      parallel: {
        ...(this.shared && { shared: this.shared }),
        ...(this.concurrenceLimit && {
          concurrency_limit: this.concurrenceLimit,
        }),
        ...(this.exceptionPolicy && { exception_policy: this.exceptionPolicy }),
        ...(this.branches && { branches: renderSteps(this.branches) }),
        ...(this.forStep && { for: this.forStep.renderBody() }),
      },
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return (this.branches ?? []).concat(this.forStep?.steps ?? [])
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/raising-errors
export class RaiseStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'raise'
  readonly value: Expression

  constructor(value: Expression) {
    this.value = value
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    return {
      name: generate('raise'),
      step: this,
    }
  }

  render(): object {
    return {
      raise: this.value.toLiteralValueOrLiteralExpression(),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/completing
export class ReturnStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'return'
  readonly value: Expression | undefined

  constructor(value: Expression | undefined) {
    this.value = value
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    return {
      name: generate('return'),
      step: this,
    }
  }

  render(): object {
    if (this.value) {
      return {
        return: this.value.toLiteralValueOrLiteralExpression(),
      }
    } else {
      return {
        next: 'end',
      }
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/steps#embedded-steps
export class StepsStepAST implements WorkflowStepAST {
  readonly tag = 'steps'
  readonly steps: WorkflowStepAST[]

  constructor(steps: WorkflowStepAST[]) {
    this.steps = steps
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    const namedSteps = this.steps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: generate('steps'),
      step: new StepsStepASTNamed(namedSteps),
    }
  }
}

export class StepsStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'steps'
  readonly steps: NamedWorkflowStep2[]

  constructor(steps: NamedWorkflowStep2[]) {
    this.steps = steps
  }

  render(): object {
    return {
      steps: renderSteps(this.steps),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return this.steps
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/conditions
export class SwitchStepAST implements WorkflowStepAST {
  readonly tag = 'switch'
  readonly branches: SwitchConditionAST[]

  constructor(branches: SwitchConditionAST[]) {
    this.branches = branches
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    const namedBranches = this.branches.map(
      (branch) =>
        new SwitchConditionASTNamed(
          branch.condition,
          branch.steps.map((astStep) => astStep.withStepNames(generate)),
        ),
    )

    return {
      name: generate('switch'),
      step: new SwitchStepASTNamed(namedBranches),
    }
  }
}

export class SwitchStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'switch'
  readonly conditions: SwitchConditionASTNamed[]
  readonly next?: StepName

  constructor(conditions: SwitchConditionASTNamed[], next?: StepName) {
    this.conditions = conditions
    this.next = next
  }

  render(): object {
    return {
      switch: this.conditions.map((cond) => cond.render()),
      ...(this.next && { next: this.next }),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return this.conditions.flatMap((x) => x.steps)
  }
}

export interface SwitchConditionAST {
  readonly condition: Expression
  readonly steps: WorkflowStepAST[]
}

export class SwitchConditionASTNamed {
  readonly condition: Expression
  readonly steps: NamedWorkflowStep2[]
  readonly next?: StepName

  constructor(
    condition: Expression,
    steps: NamedWorkflowStep2[],
    next?: StepName,
  ) {
    this.condition = condition
    this.steps = steps
    this.next = next
  }

  render(): object {
    return {
      condition: this.condition.toLiteralValueOrLiteralExpression(),
      ...(this.steps.length > 0 && { steps: renderSteps(this.steps) }),
      ...(this.next && { next: this.next }),
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/catching-errors
export class TryStepAST implements WorkflowStepAST {
  readonly tag = 'try'
  readonly trySteps: WorkflowStepAST[]
  readonly exceptSteps: WorkflowStepAST[]
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: VariableName

  constructor(
    steps: WorkflowStepAST[],
    exceptSteps: WorkflowStepAST[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: VariableName,
  ) {
    this.trySteps = steps
    this.exceptSteps = exceptSteps
    this.retryPolicy = retryPolicy
    this.errorMap = errorMap
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep2 {
    const namedTrySteps = this.trySteps.map((astStep) =>
      astStep.withStepNames(generate),
    )
    const namedExceptSteps = this.exceptSteps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: generate('try'),
      step: new TryStepASTNamed(
        namedTrySteps,
        namedExceptSteps,
        this.retryPolicy,
        this.errorMap,
      ),
    }
  }
}

export class TryStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'try'
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: StepName
  // Steps in the try block
  readonly trySteps: NamedWorkflowStep2[]
  // Steps in the except block
  readonly exceptSteps: NamedWorkflowStep2[]

  constructor(
    steps: NamedWorkflowStep2[],
    exceptSteps: NamedWorkflowStep2[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: VariableName,
  ) {
    this.trySteps = steps
    this.retryPolicy = retryPolicy
    this.errorMap = errorMap
    this.exceptSteps = exceptSteps
  }

  render(): object {
    let retry
    if (typeof this.retryPolicy === 'undefined') {
      retry = undefined
    } else if (typeof this.retryPolicy === 'string') {
      retry = `\${${this.retryPolicy}}`
    } else {
      const predicateName = this.retryPolicy.predicate
      retry = {
        predicate: `\${${predicateName}}`,
        max_retries: this.retryPolicy.maxRetries,
        backoff: {
          initial_delay: this.retryPolicy.backoff.initialDelay,
          max_delay: this.retryPolicy.backoff.maxDelay,
          multiplier: this.retryPolicy.backoff.multiplier,
        },
      }
    }

    let except
    if (this.errorMap !== undefined && this.exceptSteps.length > 0) {
      except = {
        as: this.errorMap,
        steps: renderSteps(this.exceptSteps),
      }
    } else {
      except = undefined
    }

    return {
      try: {
        steps: renderSteps(this.trySteps),
      },
      ...(retry && { retry }),
      ...(except && { except }),
    }
  }

  nestedSteps(): NamedWorkflowStep2[] {
    return this.trySteps.concat(this.exceptSteps)
  }
}

export interface CustomRetryPolicy {
  predicate: string
  maxRetries: number
  backoff: {
    initialDelay: number
    maxDelay: number
    multiplier: number
  }
}

function renderSteps(steps: NamedWorkflowStep2[]) {
  return steps.map((x) => {
    return { [x.name]: x.step.render() }
  })
}
