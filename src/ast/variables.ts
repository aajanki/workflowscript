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

interface BinaryOperation {
  // Operator such as: +, -, <, ==
  binaryOperator: string
  right: Term
}

// term: (unaryOperator)? ( VALUE | VARIABLE | LPAREN expr RPAREN )
export class Term {
  // Potentially a unary operator: -, +, not
  readonly unaryOperator?: string
  readonly value:
    | GWValue
    | GWVariableReference
    | GWParenthesizedExpression
    | FunctionInvocation

  constructor(
    value:
      | GWValue
      | GWVariableReference
      | GWParenthesizedExpression
      | FunctionInvocation,
    unaryOperator?: string,
  ) {
    this.unaryOperator = unaryOperator
    this.value = value
  }
}

// expr: term (op term)*
export class GWExpression {
  readonly left: Term
  readonly rest: BinaryOperation[]

  constructor(left: Term, rest: BinaryOperation[]) {
    this.left = left
    this.rest = rest
  }

  render(): GWValue {
    const leftVal = this.left.value

    if (this.rest.length === 0) {
      if (
        leftVal instanceof GWVariableReference ||
        leftVal instanceof GWParenthesizedExpression ||
        leftVal instanceof FunctionInvocation
      ) {
        return new GWExpressionLiteral(stringifyTerm(this.left))
      } else {
        return leftVal
      }
    } else {
      const left = stringifyTerm(this.left)
      const parts = this.rest.map(
        (x) => `${x.binaryOperator} ${stringifyTerm(x.right)}`,
      )
      parts.unshift(left)

      return new GWExpressionLiteral(parts.join(' '))
    }
  }

  toString(): string {
    const left = stringifyTerm(this.left)
    const parts = this.rest.map(
      (x) => `${x.binaryOperator} ${stringifyTerm(x.right)}`,
    )
    parts.unshift(left)

    return parts.join(' ')
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

function stringifyTerm(term: Term): string {
  let opString = term.unaryOperator ?? ''
  if (opString && !['-', '+'].includes(opString)) {
    opString += ' '
  }

  const val = term.value

  if (val instanceof GWVariableReference) {
    return `${opString}${val.toString()}`
  } else if (val instanceof GWParenthesizedExpression) {
    return `${opString}(${val.expression.toString()})`
  } else if (val instanceof FunctionInvocation) {
    return `${opString}${val.toString()}`
  } else if (Array.isArray(val)) {
    const elements = val.map((t) => {
      if (t instanceof GWExpression) {
        return t.toString()
      } else {
        return JSON.stringify(renderGWValue(t))
      }
    })
    return `${opString}[${elements.join(', ')}]`
  } else if (isRecord(val)) {
    const elements = Object.entries(val).map(([k, v]) => {
      if (v instanceof GWExpression) {
        return `"${k}": ${v.toString()}`
      } else {
        return `"${k}": ${JSON.stringify(renderGWValue(v))}`
      }
    })
    return `${opString}{${elements.join(', ')}}`
  } else if (val instanceof GWExpressionLiteral) {
    // TODO get rid of this
    return `${opString}${val.expression}`
  } else {
    return `${opString}${JSON.stringify(renderGWValue(val))}`
  }
}

function isRecord(object: unknown): object is Record<keyof never, unknown> {
  return object instanceof Object && object.constructor === Object
}
