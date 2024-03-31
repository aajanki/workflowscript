import { InternalParsingError } from '../parser/errors.js'
import { Expression, VariableName } from './expressions.js'
import {
  AssignStep,
  CallStep,
  CustomRetryPolicy,
  ForStep,
  NamedWorkflowStep,
  NextStep,
  ParallelStep,
  RaiseStep,
  ReturnStep,
  StepName,
  StepsStep,
  SwitchCondition,
  SwitchStep,
  TryExceptStep,
  VariableAssignment,
  WorkflowParameters,
} from './steps.js'
import { Subworkflow, WorkflowParameter } from './workflows.js'

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

export interface WorkflowStepAST {
  readonly tag: string

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep
}

export class AssignStepAST implements WorkflowStepAST {
  readonly tag = 'assign'
  readonly assignments: VariableAssignment[]

  constructor(assignments: VariableAssignment[]) {
    this.assignments = assignments
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: generate('assign'),
      step: new AssignStep(this.assignments),
    }
  }
}

export class CallStepAST implements WorkflowStepAST {
  readonly tag = 'call'
  readonly call: string
  readonly args?: WorkflowParameters
  readonly result?: string

  constructor(call: string, args?: WorkflowParameters, result?: string) {
    this.call = call
    this.args = args
    this.result = result
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: generate('call'),
      step: new CallStep(this.call, this.args, this.result),
    }
  }
}

export class ForStepAST implements WorkflowStepAST {
  readonly tag = 'for'
  readonly steps: WorkflowStepAST[]
  readonly loopVariableName: VariableName
  readonly listExpression: Expression

  constructor(
    steps: WorkflowStepAST[],
    loopVariableName: VariableName,
    listExpression: Expression,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedSteps = this.steps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: generate('for'),
      step: new ForStep(namedSteps, this.loopVariableName, this.listExpression),
    }
  }
}

export class NextStepAST implements WorkflowStepAST {
  readonly tag = 'next'
  readonly target: string

  constructor(target: string) {
    this.target = target
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: generate('next'),
      step: new NextStep(this.target),
    }
  }
}

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

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    let steps: Record<StepName, StepsStep> | ForStep
    if (this.steps instanceof ForStepAST) {
      const forStep = this.steps.withStepNames(generate).step

      if (!(forStep instanceof ForStep)) {
        throw new InternalParsingError('Encountered unexpected step', undefined)
      }

      steps = forStep
    } else {
      steps = Object.fromEntries(
        Object.entries(this.steps).map(([name, astStep]) => {
          const aaa = astStep.steps.map((x) => x.withStepNames(generate))
          return [name, new StepsStep(aaa)]
        }),
      )
    }

    return {
      name: generate('parallel'),
      step: new ParallelStep(
        steps,
        this.shared,
        this.concurrencyLimit,
        this.exceptionPolicy,
      ),
    }
  }
}

export class RaiseStepAST implements WorkflowStepAST {
  readonly tag = 'raise'
  readonly value: Expression

  constructor(value: Expression) {
    this.value = value
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: generate('raise'),
      step: new RaiseStep(this.value),
    }
  }
}

export class ReturnStepAST implements WorkflowStepAST {
  readonly tag = 'return'
  readonly value: Expression | undefined

  constructor(value: Expression | undefined) {
    this.value = value
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: generate('return'),
      step: new ReturnStep(this.value),
    }
  }
}

export class StepsStepAST implements WorkflowStepAST {
  readonly tag = 'steps'
  readonly steps: WorkflowStepAST[]

  constructor(steps: WorkflowStepAST[]) {
    this.steps = steps
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedSteps = this.steps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: generate('steps'),
      step: new StepsStep(namedSteps),
    }
  }
}

export class SwitchStepAST implements WorkflowStepAST {
  readonly tag = 'switch'
  readonly branches: SwitchConditionAST[]

  constructor(branches: SwitchConditionAST[]) {
    this.branches = branches
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedBranches = this.branches.map(
      (x) =>
        new SwitchCondition(x.condition, {
          steps: x.steps.map((astStep) => astStep.withStepNames(generate)),
        }),
    )

    return {
      name: generate('switch'),
      step: new SwitchStep(namedBranches),
    }
  }
}

export interface SwitchConditionAST {
  readonly condition: Expression
  readonly steps: WorkflowStepAST[]
}

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

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedTrySteps = this.trySteps.map((astStep) =>
      astStep.withStepNames(generate),
    )
    const namedExceptSteps = this.exceptSteps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: generate('try'),
      step: new TryExceptStep(
        namedTrySteps,
        namedExceptSteps,
        this.retryPolicy,
        this.errorMap,
      ),
    }
  }
}
