import { CstParser } from 'chevrotain'
import {
  Branch,
  Catch,
  Colon,
  Comma,
  Dot,
  Else,
  Equals,
  ExpressionLiteral,
  False,
  Identifier,
  If,
  LCurly,
  LParentheses,
  LSquare,
  Null,
  NumberLiteral,
  Parallel,
  RCurly,
  RParentheses,
  RSquare,
  Raise,
  Retry,
  Return,
  StringLiteral,
  True,
  Try,
  Workflow,
  tokens,
} from './lexer.js'

export class WorfkflowScriptParser extends CstParser {
  constructor() {
    super(tokens, {
      maxLookahead: 2,
    })

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

  subscriptReference = this.RULE('subscriptReference', () => {
    this.CONSUME(Identifier)
    this.MANY(() => {
      this.CONSUME(LSquare)
      this.OR([
        { ALT: () => this.CONSUME(NumberLiteral) }, // TODO: should really be an integer literal
        { ALT: () => this.CONSUME(StringLiteral) },
        { ALT: () => this.CONSUME(ExpressionLiteral) },
      ])
      this.CONSUME(RSquare)
    })
  })

  variableReference = this.RULE('variableReference', () => {
    this.SUBRULE(this.subscriptReference)
    this.MANY(() => {
      this.CONSUME(Dot)
      this.SUBRULE2(this.subscriptReference)
    })
  })

  assignmentStatement = this.RULE('assignmentStatement', () => {
    this.SUBRULE(this.variableReference)
    this.CONSUME(Equals)
    this.OR([
      { ALT: () => this.SUBRULE2(this.expression) },
      { ALT: () => this.SUBRULE2(this.callExpression) },
    ])
  })

  functionName = this.RULE('functionName', () => {
    this.CONSUME(Identifier)
    this.MANY(() => {
      this.CONSUME(Dot)
      this.CONSUME2(Identifier)
    })
  })

  actualParameterList = this.RULE('actualParameterList', () => {
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME(Identifier)
        this.CONSUME(Equals)
        this.SUBRULE(this.expression)
      },
    })
  })

  callExpression = this.RULE('callExpression', () => {
    this.SUBRULE(this.functionName)
    this.CONSUME(LParentheses)
    this.SUBRULE(this.actualParameterList)
    this.CONSUME(RParentheses)
  })

  ifStatement = this.RULE('ifStatement', () => {
    this.CONSUME(If)
    this.CONSUME(LParentheses)
    this.SUBRULE(this.expression)
    this.CONSUME(RParentheses)
    this.CONSUME(LCurly)
    this.SUBRULE(this.statementBlock)
    this.CONSUME(RCurly)
    this.MANY(() => {
      this.CONSUME(Else)
      this.CONSUME2(If)
      this.CONSUME2(LParentheses)
      this.SUBRULE2(this.expression)
      this.CONSUME2(RParentheses)
      this.CONSUME2(LCurly)
      this.SUBRULE2(this.statementBlock)
      this.CONSUME2(RCurly)
    })
    this.OPTION(() => {
      this.CONSUME2(Else)
      this.CONSUME3(LCurly)
      this.SUBRULE3(this.statementBlock)
      this.CONSUME3(RCurly)
    })
  })

  tryStatement = this.RULE('tryStatement', () => {
    this.CONSUME(Try)
    this.CONSUME(LCurly)
    this.SUBRULE(this.statementBlock)
    this.CONSUME(RCurly)
    this.OPTION(() => {
      this.CONSUME(Retry)
      this.CONSUME(LParentheses)
      this.SUBRULE(this.actualParameterList)
      this.CONSUME(RParentheses)
    })
    this.OPTION2(() => {
      this.CONSUME(Catch)
      this.CONSUME2(LParentheses)
      this.CONSUME(Identifier)
      this.CONSUME2(RParentheses)
      this.CONSUME2(LCurly)
      this.SUBRULE2(this.statementBlock)
      this.CONSUME2(RCurly)
    })
    // Check in post-processing that at least either retry or catch is specified
  })

  raiseStatement = this.RULE('raiseStatement', () => {
    this.CONSUME(Raise)
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.object) },
      { ALT: () => this.CONSUME(ExpressionLiteral) },
    ])
  })

  parallelStatement = this.RULE('parallelStatement', () => {
    this.CONSUME(Parallel)
    this.OPTION(() => {
      this.CONSUME(LParentheses)
      this.SUBRULE(this.actualParameterList)
      this.CONSUME(RParentheses)
    })
    this.AT_LEAST_ONE(() => {
      this.CONSUME(Branch)
      this.CONSUME(LCurly)
      this.SUBRULE(this.statementBlock)
      this.CONSUME(RCurly)
    })
  })

  returnStatement = this.RULE('returnStatement', () => {
    this.CONSUME(Return)
    this.SUBRULE(this.expression)
  })

  statement = this.RULE('statement', () => {
    this.OR([
      {
        // TODO: restructure the common parts in function name/variable name
        // grammar so that backtracking is not required
        GATE: this.BACKTRACK(this.assignmentStatement),
        ALT: () => this.SUBRULE(this.assignmentStatement),
      },
      { ALT: () => this.SUBRULE(this.callExpression) }, // a function call without assigning the return value
      { ALT: () => this.SUBRULE(this.ifStatement) },
      { ALT: () => this.SUBRULE(this.parallelStatement) },
      { ALT: () => this.SUBRULE(this.tryStatement) },
      { ALT: () => this.SUBRULE(this.raiseStatement) },
      { ALT: () => this.SUBRULE(this.returnStatement) },
    ])
  })

  statementBlock = this.RULE('statementBlock', () => {
    this.MANY(() => {
      this.SUBRULE(this.statement)
    })
  })

  formalParameter = this.RULE('formalParameter', () => {
    this.CONSUME(Identifier)
    this.OPTION(() => {
      this.CONSUME(Equals)
      this.SUBRULE(this.expression)
    })
  })

  formalParameterList = this.RULE('formalParameterList', () => {
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.formalParameter)
      },
    })
  })

  subworkflowDefinition = this.RULE('subworkflowDefinition', () => {
    this.CONSUME(Workflow)
    this.CONSUME(Identifier)
    this.CONSUME(LParentheses)
    this.SUBRULE(this.formalParameterList)
    this.CONSUME(RParentheses)
    this.CONSUME(LCurly)
    this.SUBRULE(this.statementBlock)
    this.CONSUME(RCurly)
  })

  program = this.RULE('program', () => {
    this.MANY(() => {
      this.SUBRULE(this.subworkflowDefinition)
    })
  })
}
