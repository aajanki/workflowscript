/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { CstParser } from 'chevrotain'
import {
  Colon,
  Comma,
  Equals,
  ExpressionLiteral,
  False,
  Identifier,
  LCurly,
  LParentheses,
  LSquare,
  Null,
  NumberLiteral,
  RCurly,
  RParentheses,
  RSquare,
  Return,
  StringLiteral,
  True,
  Workflow,
  tokens,
} from './lexer.js'
import {
  AssignStep,
  GWAssignment,
  NamedWorkflowStep,
  ReturnStep,
} from './steps.js'
import { Subworkflow, WorkflowApp, WorkflowParameter } from './workflows.js'
import { GWExpression, GWValue } from './variables.js'

export class WorfkflowScriptParser extends CstParser {
  constructor() {
    super(tokens)

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

  assignmentStatement = this.RULE('assignmentStatement', () => {
    // Combine multiple consequtive assignments into a single step
    this.AT_LEAST_ONE(() => {
      this.CONSUME(Identifier)
      this.CONSUME(Equals)
      this.SUBRULE(this.expression)
    })
  })

  returnStatement = this.RULE('returnStatement', () => {
    this.CONSUME(Return)
    this.SUBRULE(this.expression)
  })

  statement = this.RULE('statement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.assignmentStatement) },
      { ALT: () => this.SUBRULE(this.returnStatement) },
    ])
  })

  workflowBody = this.RULE('workflowBody', () => {
    this.MANY(() => {
      this.SUBRULE(this.statement)
    })
  })

  formalParameterList = this.RULE('formalParameterList', () => {
    // TODO: default values
    this.CONSUME(Identifier)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.CONSUME2(Identifier)
    })
  })

  subworkflowDefinition = this.RULE('subworkflowDefinition', () => {
    this.CONSUME(Workflow)
    this.CONSUME(Identifier)
    this.CONSUME(LParentheses)
    this.OPTION(() => {
      this.SUBRULE(this.formalParameterList)
    })
    this.CONSUME(RParentheses)
    this.CONSUME(LCurly)
    this.SUBRULE(this.workflowBody)
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
  const stepNameGenerator = new StepNameGenerator()

  class WorkflowscriptVisitor extends BaseWorkflowscriptCstVisitor {
    constructor() {
      super()
      this.validateVisitor()
    }

    object(ctx: any): Record<string, GWValue> {
      return Object.fromEntries(ctx.objectItem.map((x: any) => this.visit(x)))
    }

    objectItem(ctx: any): [string, GWValue] {
      return [
        unescapeQuotes(ctx.StringLiteral[0].image.slice(1, -1)),
        this.visit(ctx.expression[0]) as GWValue,
      ]
    }

    array(ctx: any): GWValue[] {
      return ctx.expression.map((val: any) => this.visit(val))
    }

    expression(ctx: any): GWValue {
      if (ctx.StringLiteral) {
        return unescapeQuotes(ctx.StringLiteral[0].image.slice(1, -1))
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

    assignmentStatement(ctx: any): NamedWorkflowStep {
      const assignments: GWAssignment[] = ctx.Identifier.map(
        (identifierCtx: any, i: number) => {
          return [identifierCtx.image, this.visit(ctx.expression[i])]
        },
      )

      return {
        name: stepNameGenerator.generate('assign'),
        step: new AssignStep(assignments),
      }
    }

    returnStatement(ctx: any): NamedWorkflowStep {
      return {
        name: stepNameGenerator.generate('return'),
        step: new ReturnStep(this.visit(ctx.expression[0])),
      }
    }

    statement(ctx: any): NamedWorkflowStep {
      if (ctx.assignmentStatement) {
        return this.visit(ctx.assignmentStatement[0])
      } else if (ctx.returnStatement) {
        return this.visit(ctx.returnStatement[0])
      } else {
        throw new Error('not implmeneted')
      }
    }

    workflowBody(ctx: any): NamedWorkflowStep[] {
      if (ctx.statement) {
        return ctx.statement.map((statementCtx: any) =>
          this.visit(statementCtx),
        )
      } else {
        return []
      }
    }

    formalParameterList(ctx: any): NamedWorkflowStep[] {
      return ctx.Identifier.map((x: any) => {
        return { name: x.image }
      })
    }

    subworkflowDefinition(ctx: any): Subworkflow {
      const workflowName: string = ctx.Identifier[0].image
      let params: WorkflowParameter[] = []
      const steps: NamedWorkflowStep[] = this.visit(ctx.workflowBody)

      if (ctx.formalParameterList) {
        params = this.visit(ctx.formalParameterList)
      }

      return new Subworkflow(workflowName, steps, params)
    }

    program(ctx: any): WorkflowApp {
      const workflows: Subworkflow[] = ctx.subworkflowDefinition.map(
        (subctx: any) => this.visit(subctx),
      )

      return new WorkflowApp(workflows)
    }
  }

  return new WorkflowscriptVisitor()
}

class StepNameGenerator {
  counters = new Map<string, number>()

  generate(prefix: string): string {
    const i = this.counters.get(prefix) ?? 1

    this.counters.set(prefix, i + 1)

    return `${prefix}${i}`
  }
}

function unescapeQuotes(str: string) {
  return str.replaceAll(/\\"/g, '"')
}
