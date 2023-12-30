import { Lexer, createToken } from 'chevrotain'

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
  pattern: /null/,
  longer_alt: Identifier,
})
export const LParentheses = createToken({
  name: 'Left parentheses',
  pattern: /\(/,
})
export const RParentheses = createToken({
  name: 'Right parentheses',
  pattern: /\)/,
})
export const LCurly = createToken({ name: 'Left curly bracket', pattern: /{/ })
export const RCurly = createToken({ name: 'Right curly bracket', pattern: /}/ })
export const LSquare = createToken({
  name: 'Left square bracket',
  pattern: /\[/,
})
export const RSquare = createToken({
  name: 'Right square bracket',
  pattern: /]/,
})
export const Comma = createToken({ name: 'Comma', pattern: /,/ })
export const Colon = createToken({ name: 'Colon', pattern: /:/ })
export const Equals = createToken({ name: 'Equals', pattern: /=/ })
export const Return = createToken({
  name: 'return keyword',
  pattern: /return/,
})
export const Workflow = createToken({
  name: 'Workflow keyword',
  pattern: /workflow/,
})
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^\\"]|\\[bfnrtv"\\/])*"/,
})
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
})
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
})

export const tokens = [
  WhiteSpace,
  NumberLiteral,
  StringLiteral,
  LParentheses,
  RParentheses,
  LCurly,
  RCurly,
  LSquare,
  RSquare,
  Comma,
  Colon,
  Equals,
  True,
  False,
  Null,
  Return,
  Workflow,
  Identifier,
]

export const workflowScriptLexer = new Lexer(tokens)
