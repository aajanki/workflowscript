export type Primitive =
  | null
  | string
  | number
  | boolean
  | (Primitive | Expression)[]
  | { [key: string]: Primitive | Expression }

export type LiteralValueOrLiteralExpression =
  | null
  | string
  | number
  | boolean
  | LiteralValueOrLiteralExpression[]
  | { [key: string]: LiteralValueOrLiteralExpression }

// Convert a Primitive to a string representation.
// Does not add ${}.
function primitiveToString(val: Primitive): string {
  if (Array.isArray(val)) {
    const elements = val.map((x) => {
      if (x instanceof Expression) {
        return x.toString()
      } else {
        return primitiveToString(x)
      }
    })

    return `[${elements.join(', ')}]`
  } else if (val !== null && typeof val === 'object') {
    const items = Object.entries(val).map(([k, v]) => {
      if (v instanceof Expression) {
        return [k, v.toString()]
      } else {
        return [k, primitiveToString(v)]
      }
    })
    const elements = items.map(([k, v]) => `"${k}":${v}`)

    return `{${elements.join(',')}}`
  } else {
    return JSON.stringify(val)
  }
}

export type VariableName = string

// A plain identifier (y, year), property access (person.name), list element accessor (names[3])
export class VariableReference {
  readonly name: VariableName

  constructor(name: VariableName) {
    this.name = name
  }

  toString(): string {
    return this.name
  }
}

export class FunctionInvocation {
  readonly funcName: string
  readonly arguments: Expression[]

  constructor(functionName: string, argumentExpressions: Expression[]) {
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
    | Primitive
    | VariableReference
    | ParenthesizedExpression
    | FunctionInvocation

  constructor(
    value:
      | Primitive
      | VariableReference
      | ParenthesizedExpression
      | FunctionInvocation,
    unaryOperator?: string,
  ) {
    this.unaryOperator = unaryOperator
    this.value = value
  }

  // Does not add ${}.
  toString(): string {
    let opString = this.unaryOperator ?? ''
    if (opString && !['-', '+'].includes(opString)) {
      opString += ' '
    }

    const val = this.value

    if (val instanceof VariableReference) {
      return `${opString}${val.toString()}`
    } else if (val instanceof ParenthesizedExpression) {
      return `${opString}(${val.expression.toString()})`
    } else if (val instanceof FunctionInvocation) {
      return `${opString}${val.toString()}`
    } else if (Array.isArray(val)) {
      const elements = val.map((t) => {
        if (t instanceof Expression) {
          return t.toString()
        } else {
          return primitiveToString(t)
        }
      })
      return `${opString}[${elements.join(', ')}]`
    } else if (isRecord(val)) {
      const elements = Object.entries(val).map(([k, v]) => {
        if (v instanceof Expression) {
          return `"${k}": ${v.toString()}`
        } else {
          return `"${k}": ${primitiveToString(v)}`
        }
      })
      return `${opString}{${elements.join(', ')}}`
    } else {
      return `${opString}${JSON.stringify(val)}`
    }
  }

  // Returns a literal for simple terms and a literal expression enclosed in ${} for complex terms.
  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    if (typeof this.value === 'number') {
      if (this.unaryOperator === '-') {
        return -this.value
      } else {
        return this.value
      }
    } else if (typeof this.value === 'string' && !this.unaryOperator) {
      return this.value
    } else if (typeof this.value === 'boolean' && !this.unaryOperator) {
      return this.value
    } else if (this.value === null) {
      return this.value
    } else if (Array.isArray(this.value)) {
      return this.value.map((x) => {
        if (x instanceof Expression) {
          return x.toLiteralValueOrLiteralExpression()
        } else if (
          x === null ||
          typeof x === 'string' ||
          typeof x === 'number' ||
          typeof x === 'boolean'
        ) {
          return x
        } else {
          return `\${${primitiveToString(x)}}`
        }
      })
    } else if (isRecord(this.value)) {
      return Object.fromEntries(
        Object.entries(this.value).map(([k, v]) => {
          if (v instanceof Expression) {
            return [k, v.toLiteralValueOrLiteralExpression()]
          } else if (
            v === null ||
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean'
          ) {
            return [k, v]
          } else {
            return [k, `\${${primitiveToString(v)}}`]
          }
        }),
      )
    } else {
      return `\${${this.toString()}}`
    }
  }
}

// expr: term (op term)*
export class Expression {
  readonly left: Term
  readonly rest: BinaryOperation[]

  constructor(left: Term, rest: BinaryOperation[]) {
    this.left = left
    this.rest = rest
  }

  // Does not add ${}.
  toString(): string {
    const left = this.left.toString()
    const parts = this.rest.map(
      (x) => `${x.binaryOperator} ${x.right.toString()}`,
    )
    parts.unshift(left)

    return parts.join(' ')
  }

  // Returns a literal for simple expressions and a literal expression enclosed in ${} for complex expressions.
  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    if (this.rest.length === 0) {
      return this.left.toLiteralValueOrLiteralExpression()
    } else {
      return `\${${this.toString()}}`
    }
  }
}

export class ParenthesizedExpression {
  readonly expression: Expression

  constructor(expression: Expression) {
    this.expression = expression
  }
}

export class ExpressionLiteral {
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

function isRecord(object: unknown): object is Record<keyof never, unknown> {
  return object instanceof Object && object.constructor === Object
}
