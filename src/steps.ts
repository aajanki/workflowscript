import type { GWValue, GWVariableName } from './variables.js'
import { renderGWValue } from './variables.js'

export type GWStepName = string
export type GWAssignment = readonly [GWVariableName, GWValue]

export interface WorkflowStep {
  render(): object
  nestedSteps(): NamedWorkflowStep[]
}

export interface NamedWorkflowStep {
  name: GWStepName
  step: WorkflowStep
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
        return { [key]: renderGWValue(val) }
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
  readonly args?: GWAssignment[]
  readonly result?: string

  constructor(call: string, args?: GWAssignment[], result?: string) {
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
        this.args.map(([k, v]) => {
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

// https://cloud.google.com/workflows/docs/reference/syntax/completing
export class ReturnStep implements WorkflowStep {
  readonly value: GWValue

  constructor(value: GWValue) {
    this.value = value
  }

  render(): object {
    return {
      return: renderGWValue(this.value),
    }
  }

  nestedSteps(): NamedWorkflowStep[] {
    return []
  }
}
