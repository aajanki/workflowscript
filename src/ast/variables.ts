export type GWVariableName = string
export type GWValue =
  | null
  | string
  | number
  | boolean
  | GWValue[]
  | { [key: string]: GWValue }
  | GWExpressionLiteral

export function renderGWValue(
  val: GWValue,
): null | string | number | boolean | object {
  if (val instanceof GWExpressionLiteral) {
    return val.render()
  } else if (Array.isArray(val)) {
    return val.map(renderGWValue)
  } else if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, renderGWValue(v)]),
    )
  } else {
    return val
  }
}

// A plain identifier (y, year), property access (person.name), list element accessor (names[3])
export class GWVariableReference {
  readonly name: GWVariableName

  constructor(name: GWVariableName) {
    this.name = name
  }

  render(): string {
    return this.name
  }
}

// Operator such as: +, -, <, ==, not
interface GWOperation { operator: string; right: GWTerm }

// expr: term (op term)*
// term: VALUE | VARIABLE | LPAREN expr PAREN
export type GWTerm = GWValue | GWVariableReference // | (expr)
export class GWExpression {
  readonly left: GWTerm
  readonly rest: GWOperation[]

  constructor(left: GWTerm, rest: GWOperation[]) {
    this.left = left
    this.rest = rest
  }
}

export class GWExpressionLiteral {
  readonly expression: string

  constructor(ex: string) {
    // Detect injections. I don't know if these can be escaped somehow if used in string for example.
    if (ex.includes('$') || ex.includes('{') || ex.includes('}')) {
      throw new Error(`Unsupported expression: ${ex}`)
    }

    this.expression = ex
  }

  render(): string {
    return '${' + this.expression + '}'
  }
}

// A short-hand syntax for writing an expression literal: $('a + 1')
export function $(ex: string): GWExpressionLiteral {
  return new GWExpressionLiteral(ex)
}
