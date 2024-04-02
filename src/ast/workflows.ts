import * as YAML from 'yaml'

import { VariableName, LiteralValueOrLiteralExpression } from './expressions.js'
import { NamedWorkflowStep2 } from './steps.js'

export interface WorkflowParameter {
  name: VariableName
  default?: LiteralValueOrLiteralExpression
}

/**
 * This is the main container class that brings together all subworkflows in a program
 */
export class WorkflowApp {
  readonly subworkflows: Subworkflow[]

  constructor(subworkflows: Subworkflow[] = []) {
    this.subworkflows = subworkflows
  }

  render(): object {
    return Object.fromEntries(
      new Map(this.subworkflows.map((wf) => [wf.name, wf.renderBody()])),
    )
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/subworkflows
export class Subworkflow {
  readonly name: string
  readonly steps: NamedWorkflowStep2[]
  readonly params?: WorkflowParameter[]

  constructor(
    name: string,
    steps: NamedWorkflowStep2[],
    params?: WorkflowParameter[],
  ) {
    this.name = name
    this.steps = steps
    this.params = params
  }

  render(): object {
    return {
      [this.name]: this.renderBody(),
    }
  }

  renderBody(): object {
    const body = {
      steps: this.steps.map(({ name, step }) => {
        return { [name]: step.render() }
      }),
    }

    if (this.params && this.params.length > 0) {
      Object.assign(body, {
        params: this.params.map((x) => {
          if (x.default) {
            return { [x.name]: x.default }
          } else {
            return x.name
          }
        }),
      })
    }

    return body
  }

  *iterateStepsDepthFirst(): IterableIterator<NamedWorkflowStep2> {
    const visited = new Set()

    function* visitPreOrder(
      step: NamedWorkflowStep2,
    ): IterableIterator<NamedWorkflowStep2> {
      if (!visited.has(step)) {
        visited.add(step)

        yield step

        for (const x of step.step.nestedSteps()) {
          yield* visitPreOrder(x)
        }
      }
    }

    for (const step of this.steps) {
      yield* visitPreOrder(step)
    }
  }
}

/**
 * Print the workflow as a YAML string.
 */
export function toYAMLString(workflow: WorkflowApp): string {
  return YAML.stringify(workflow.render(), {
    lineWidth: 100,
  })
}
