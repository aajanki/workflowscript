import type { GWExpression, GWValue, GWVariableName } from './variables.js'
import { renderGWValue } from './variables.js'

export type GWStepName = string
export type GWAssignment = readonly [GWVariableName, GWExpression]
export type GWArguments = Record<GWVariableName, GWValue>

export interface WorkflowStep {
  render(): object
  nestedSteps(): NamedWorkflowStep[]
}

export interface NamedWorkflowStep {
  name: GWStepName
  step: WorkflowStep
}

export function namedStep(name: string, step: WorkflowStep) {
  return { name, step }
}

// https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step
export class AssignStep implements WorkflowStep {
  readonly assignments: GWAssignment[]

  constructor(assignments: GWAssignment[]) {
    this.assignments = assignments
  }

  render(): object {
    return {
      assign: this.assignments.map(([key, val]) => {
        return { [key]: renderGWValue(val.render()) }
      }),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/calls
export class CallStep implements WorkflowStep {
  readonly call: string
  readonly args?: GWArguments
  readonly result?: string

  constructor(call: string, args?: GWArguments, result?: string) {
    this.call = call
    this.args = args
    this.result = result
  }

  render(): object {
    let args:
      | Record<string, null | string | number | boolean | object>
      | undefined = undefined
    if (this.args) {
      args = Object.fromEntries(
        Object.entries(this.args).map(([k, v]) => {
          return [k, renderGWValue(v)]
        }),
      )
    }

    return {
      call: this.call,
      ...(args && { args }),
      ...(this.result && { result: this.result }),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return []
  }
}

export class SwitchCondition {
  readonly condition: GWExpression
  readonly next?: GWStepName
  readonly steps: NamedWorkflowStep[]

  constructor(
    condition: GWExpression,
    options: { next: GWStepName } | { steps: NamedWorkflowStep[] },
  ) {
    this.condition = condition

    if ('next' in options) {
      this.next = options.next
      this.steps = []
    } else {
      this.next = undefined
      this.steps = options.steps
    }
  }

  render(): object {
    return {
      condition: renderGWValue(this.condition.render()),
      ...(this.next && { next: this.next }),
      ...(this.steps.length > 0 && { steps: renderSteps(this.steps) }),
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/conditions
export class SwitchStep implements WorkflowStep {
  readonly conditions: SwitchCondition[]
  readonly next?: GWStepName

  constructor(conditions: SwitchCondition[], next?: GWStepName) {
    this.conditions = conditions
    this.next = next
  }

  render(): object {
    return {
      switch: this.conditions.map((cond) => cond.render()),
      ...(this.next && { next: this.next }),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return this.conditions.flatMap((x) => x.steps)
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/steps#embedded-steps
export class StepsStep implements WorkflowStep {
  readonly steps: NamedWorkflowStep[]

  // @ts-expect-error Discriminate this from a generic WorkflowStep in type checking.
  private readonly _isStepsStep: boolean = true

  constructor(steps: NamedWorkflowStep[]) {
    this.steps = steps
  }

  render(): object {
    return {
      steps: renderSteps(this.steps),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return this.steps
  }
}

export class NextStep implements WorkflowStep {
  readonly target: string

  constructor(target: string) {
    this.target = target
  }

  render(): object {
    return {
      next: this.target,
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return []
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/iteration
export class ForStep implements WorkflowStep {
  readonly steps: NamedWorkflowStep[]
  readonly loopVariableName: GWVariableName
  readonly indexVariableName?: GWVariableName
  readonly listExpression?: GWExpression
  readonly rangeStart?: number
  readonly rangeEnd?: number

  constructor(
    steps: NamedWorkflowStep[],
    loopVariable: GWVariableName,
    listExpression?: GWExpression,
    indexVariable?: GWVariableName,
    rangeStart?: number,
    rangeEnd?: number,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariable
    this.indexVariableName = indexVariable
    this.listExpression = listExpression
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
      inValue = renderGWValue(this.listExpression.render())
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

  nestedSteps(): NamedWorkflowStep[] {
    return this.steps
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps
export class ParallelStep implements WorkflowStep {
  // Steps for each branch
  readonly branches?: NamedWorkflowStep[]
  readonly forStep?: ForStep
  readonly shared?: GWVariableName[]
  readonly concurrenceLimit?: number
  readonly exceptionPolicy?: string

  constructor(
    steps: Record<GWStepName, StepsStep> | ForStep,
    shared?: GWVariableName[],
    concurrencyLimit?: number,
    exceptionPolicy?: string,
  ) {
    this.shared = shared
    this.concurrenceLimit = concurrencyLimit
    this.exceptionPolicy = exceptionPolicy

    if (steps instanceof ForStep) {
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

  nestedSteps(): NamedWorkflowStep[] {
    return (this.branches ?? []).concat(this.forStep?.steps ?? [])
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/completing
export class ReturnStep implements WorkflowStep {
  readonly value: GWExpression

  constructor(value: GWExpression) {
    this.value = value
  }

  render(): object {
    return {
      return: renderGWValue(this.value.render()),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return []
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

// https://cloud.google.com/workflows/docs/reference/syntax/catching-errors
export class TryExceptStep implements WorkflowStep {
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: GWStepName
  // Steps in the try block
  readonly trySteps: NamedWorkflowStep[]
  // Steps in the except block
  readonly exceptSteps: NamedWorkflowStep[]

  constructor(
    steps: NamedWorkflowStep[],
    exceptSteps: NamedWorkflowStep[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: GWVariableName,
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
    if (this.errorMap !== undefined || this.exceptSteps !== undefined) {
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

  nestedSteps(): NamedWorkflowStep[] {
    return this.trySteps.concat(this.exceptSteps)
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/raising-errors
export class RaiseStep implements WorkflowStep {
  readonly value: GWExpression

  constructor(value: GWExpression) {
    this.value = value
  }

  render(): object {
    return {
      raise: renderGWValue(this.value.render()),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return []
  }
}

function renderSteps(steps: NamedWorkflowStep[]) {
  return steps.map((x) => {
    return { [x.name]: x.step.render() }
  })
}
