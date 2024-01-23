import { Lexer, createToken } from 'chevrotain'

export const UnaryOperator = createToken({
  name: 'UnaryOperator',
  pattern: Lexer.NA,
})
export const BinaryOperator = createToken({
  name: 'BinaryOperator',
  pattern: Lexer.NA,
})
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
})
export const True = createToken({
  name: 'True',
  pattern: /true|True|TRUE/,
  longer_alt: Identifier,
})
export const False = createToken({
  name: 'False',
  pattern: /false|False|FALSE/,
  longer_alt: Identifier,
})
export const Null = createToken({
  name: 'Null',
  pattern: 'null',
  longer_alt: Identifier,
})
export const LParenthesis = createToken({
  name: 'LeftParenthesis',
  pattern: '(',
})
export const RParenthesis = createToken({
  name: 'RightParenthesis',
  pattern: ')',
})
export const LCurly = createToken({ name: 'Left curly bracket', pattern: '{' })
export const RCurly = createToken({ name: 'Right curly bracket', pattern: '}' })
export const LSquare = createToken({
  name: 'LeftSquareBracket',
  pattern: '[',
})
export const RSquare = createToken({
  name: 'RightSquareBracket',
  pattern: ']',
})
export const Comma = createToken({ name: 'Comma', pattern: ',' })
export const Dot = createToken({ name: 'Dot', pattern: '.' })
export const Colon = createToken({ name: 'Colon', pattern: ':' })
export const Assignment = createToken({ name: 'Assignment', pattern: '=' })
export const Plus = createToken({
  name: 'Plus',
  pattern: '+',
  categories: [BinaryOperator, UnaryOperator],
})
export const Minus = createToken({
  name: 'Minus',
  pattern: '-',
  categories: [BinaryOperator, UnaryOperator],
})
export const Multiplication = createToken({
  name: 'Multiplication',
  pattern: '*',
  categories: [BinaryOperator],
})
export const Division = createToken({
  name: 'Division',
  pattern: '/',
  categories: [BinaryOperator],
})
export const RemainderDivision = createToken({
  name: 'RemainderDivision',
  pattern: '%',
  categories: [BinaryOperator],
})
export const LessThanOrEqualTo = createToken({
  name: 'LessThanOrEqualTo',
  pattern: '<=',
  categories: [BinaryOperator],
})
export const GreaterThanOrEqualTo = createToken({
  name: 'GreaterThanOrEqualTo',
  pattern: '>=',
  categories: [BinaryOperator],
})
export const LessThan = createToken({
  name: 'LessThan',
  pattern: '<',
  categories: [BinaryOperator],
})
export const GreaterThan = createToken({
  name: 'GreaterThan',
  pattern: '>',
  categories: [BinaryOperator],
})
export const EqualTo = createToken({
  name: 'EqualTo',
  pattern: '==',
  categories: [BinaryOperator],
})
export const NotEqualTo = createToken({
  name: 'NotEqualTo',
  pattern: '!=',
  categories: [BinaryOperator],
})
export const And = createToken({
  name: 'And',
  pattern: 'and',
  categories: [BinaryOperator],
  longer_alt: Identifier,
})
export const Or = createToken({
  name: 'Or',
  pattern: 'or',
  categories: [BinaryOperator],
  longer_alt: Identifier,
})
export const Not = createToken({
  name: 'Not',
  pattern: 'not',
  categories: [UnaryOperator],
  longer_alt: Identifier,
})
export const If = createToken({
  name: 'If',
  pattern: 'if',
  longer_alt: Identifier,
})
export const Else = createToken({
  name: 'Else',
  pattern: 'else',
  longer_alt: Identifier,
})
export const Return = createToken({
  name: 'Return',
  pattern: 'return',
  longer_alt: Identifier,
})
export const Parallel = createToken({
  name: 'Parallel',
  pattern: 'parallel',
  longer_alt: Identifier,
})
export const Branch = createToken({
  name: 'Branch',
  pattern: 'branch',
  longer_alt: Identifier,
})
export const Try = createToken({
  name: 'Try',
  pattern: 'try',
  longer_alt: Identifier,
})
export const Retry = createToken({
  name: 'Retry',
  pattern: 'retry',
  longer_alt: Identifier,
})
export const Catch = createToken({
  name: 'Catch',
  pattern: 'catch',
  longer_alt: Identifier,
})
export const Throw = createToken({
  name: 'Throw',
  pattern: 'throw',
  longer_alt: Identifier,
})
export const For = createToken({
  name: 'For',
  pattern: 'for',
  longer_alt: Identifier,
})
export const In = createToken({
  name: 'In',
  pattern: 'in',
  categories: [BinaryOperator],
  longer_alt: Identifier,
})
export const Break = createToken({
  name: 'Break',
  pattern: 'break',
  longer_alt: Identifier,
})
export const Continue = createToken({
  name: 'Continue',
  pattern: 'continue',
  longer_alt: Identifier,
})
export const Workflow = createToken({
  name: 'Workflow',
  pattern: 'workflow',
  longer_alt: Identifier,
})
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^\\"]|\\(?:[bfnrtv"\\/]|u[0-9a-fA-F]{4}))*"/,
})
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
})
export const ExpressionLiteral = createToken({
  name: 'ExpressionLiteral',
  pattern: /\$\{[^}]*\}/,
})
export const SingleLineComment = createToken({
  name: 'SingleLineComment ',
  pattern: /\/\/[^\n\r]*/,
  group: Lexer.SKIPPED,
})
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
})

export const tokens = [
  UnaryOperator,
  BinaryOperator,
  WhiteSpace,
  SingleLineComment,
  NumberLiteral,
  StringLiteral,
  ExpressionLiteral,
  LParenthesis,
  RParenthesis,
  LCurly,
  RCurly,
  LSquare,
  RSquare,
  Comma,
  Dot,
  LessThanOrEqualTo,
  GreaterThanOrEqualTo,
  LessThan,
  GreaterThan,
  EqualTo,
  NotEqualTo,
  And,
  Or,
  Not,
  Colon,
  Assignment,
  Plus,
  Minus,
  Multiplication,
  Division,
  RemainderDivision,
  True,
  False,
  Null,
  If,
  Else,
  Try,
  Retry,
  Catch,
  Throw,
  For,
  In,
  Break,
  Continue,
  Return,
  Workflow,
  Parallel,
  Branch,
  Identifier,
]

export const workflowScriptLexer = new Lexer(tokens)
