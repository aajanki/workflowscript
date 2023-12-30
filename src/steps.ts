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

export function assign(
  name: GWStepName,
  assignments: GWAssignment[],
): NamedWorkflowStep {
  return { name, step: new AssignStep(assignments) }
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

export function returnStep(
  name: GWStepName,
  value: GWValue,
): NamedWorkflowStep {
  return { name, step: new ReturnStep(value) }
}
