import { WorkflowAST } from './index.js'
import { WorkflowApp } from './workflows.js'

export class StepNameGenerator {
  private counters: Map<string, number>

  constructor() {
    this.counters = new Map<string, number>()
  }

  generate(prefix: string): string {
    const i = this.counters.get(prefix) ?? 1
    this.counters.set(prefix, i + 1)

    return `${prefix}${i}`
  }
}

export function generateStepNames(ast: WorkflowAST): WorkflowApp {
  const stepNameGenerator = new StepNameGenerator()
  const subworkflows = ast.subworkflows.map((subworkflow) => {
    return subworkflow.withStepNames((x) => stepNameGenerator.generate(x))
  })

  return new WorkflowApp(subworkflows)
}
