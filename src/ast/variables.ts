export type GWVariableName = string
export type GWValue =
  | null
  | string
  | number
  | boolean
  | (GWValue | GWExpression)[]
  | { [key: string]: GWValue | GWExpression }
  | GWExpressionLiteral

export function renderGWValue(
  val: GWValue,
): null | string | number | boolean | object {
  if (val instanceof GWExpressionLiteral) {
    return val.render()
  } else if (Array.isArray(val)) {
    return val.map((x) => {
      if (x instanceof GWExpression) {
        return x.render()
      } else {
        return renderGWValue(x)
      }
    })
  } else if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => {
        if (v instanceof GWExpression) {
          return [k, v.render()]
        } else {
          return [k, renderGWValue(v)]
        }
      }),
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

  toString(): string {
    return this.name
  }
}

export class FunctionInvocation {
  readonly funcName: string
  readonly arguments: GWExpression[]

  constructor(functionName: string, argumentExpressions: GWExpression[]) {
    this.funcName = functionName
    this.arguments = argumentExpressions
  }

  toString(): string {
    const argumentStrings = this.arguments.map((x) => x.toString())
    return `${this.funcName}(${argumentStrings.join(', ')})`
  }
}

interface GWOperation {
  // Operator such as: +, -, <, ==, not
  operator: string
  right: GWTerm
}

// expr: term (op term)*
// term: VALUE | VARIABLE | LPAREN expr RPAREN
export type GWTerm =
  | GWValue
  | GWVariableReference
  | GWParenthesizedExpression
  | FunctionInvocation
export class GWExpression {
  readonly left: GWTerm
  readonly rest: GWOperation[]

  constructor(left: GWTerm, rest: GWOperation[]) {
    this.left = left
    this.rest = rest
  }

  render(): GWValue {
    if (this.rest.length === 0) {
      if (
        this.left instanceof GWVariableReference ||
        this.left instanceof GWParenthesizedExpression ||
        this.left instanceof FunctionInvocation
      ) {
        return new GWExpressionLiteral(stringifyTerm(this.left))
      } else {
        return this.left
      }
    } else {
      const left = stringifyTerm(this.left)
      const parts = this.rest.map(
        (x) => `${x.operator} ${stringifyTerm(x.right)}`,
      )
      parts.unshift(left)

      return new GWExpressionLiteral(parts.join(' '))
    }
  }

  toString(): string {
    if (this.rest.length === 0) {
      if (
        this.left instanceof GWVariableReference ||
        this.left instanceof GWParenthesizedExpression ||
        this.left instanceof FunctionInvocation
      ) {
        return stringifyTerm(this.left)
      } else {
        return JSON.stringify(this.left)
      }
    } else {
      const left = stringifyTerm(this.left)
      const parts = this.rest.map(
        (x) => `${x.operator} ${stringifyTerm(x.right)}`,
      )
      parts.unshift(left)

      return parts.join(' ')
    }
  }
}

export class GWParenthesizedExpression {
  readonly expression: GWExpression

  constructor(expression: GWExpression) {
    this.expression = expression
  }
}

export class GWExpressionLiteral {
  readonly expression: string

  constructor(ex: string) {
    // Detect injections. I don't know if these can be escaped somehow if used in string for example.
    if (ex.includes('${')) {
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

function stringifyTerm(term: GWTerm): string {
  if (term instanceof GWVariableReference) {
    return term.toString()
  } else if (term instanceof GWParenthesizedExpression) {
    return `(${term.expression.toString()})`
  } else if (term instanceof FunctionInvocation) {
    return term.toString()
  } else if (Array.isArray(term)) {
    const elements = term.map((t) => {
      if (t instanceof GWExpression) {
        return t.toString()
      } else {
        return stringifyTerm(t)
      }
    })
    return `[${elements.join(', ')}]`
  } else if (isRecord(term)) {
    const elements = Object.entries(term).map(([k, v]) => {
      if (v instanceof GWExpression) {
        return `"${k}": ${v.toString()}`
      } else {
        return `"${k}": ${stringifyTerm(v)}`
      }
    })
    return `{${elements.join(', ')}}`
  } else if (term instanceof GWExpressionLiteral) {
    // TODO get rid of this
    return term.expression
  } else {
    return JSON.stringify(renderGWValue(term))
  }
}

function isRecord(object: unknown): object is Record<keyof never, unknown> {
  return object instanceof Object && object.constructor === Object
}
