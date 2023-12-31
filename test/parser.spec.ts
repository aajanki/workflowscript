import { expect } from 'chai'
import { CstNode } from 'chevrotain'
import { workflowScriptLexer } from '../src/lexer.js'
import { WorfkflowScriptParser, createVisitor } from '../src/parser.js'

describe('workflow definition parsing', () => {
  it('parses empty subworkflow definition', () => {
    const block = 'workflow main() { }'

    const ast = parseOneRule(block, (p) => p.subworkflowDefinition())

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [],
      },
    })
  })

  it('parses subworkflow definition with parameters', () => {
    const block = 'workflow mySubworkflow(width, height) { }'

    const ast = parseOneRule(block, (p) => p.subworkflowDefinition())

    expect(ast.render()).to.deep.equal({
      mySubworkflow: {
        params: ['width', 'height'],
        steps: [],
      },
    })
  })

  it('parses subworkflow definition with body', () => {
    const block = `workflow addOne(a) {
      res = \${a + 1}
      return \${res}
    }`

    const ast = parseOneRule(block, (p) => p.subworkflowDefinition())

    expect(ast.render()).to.deep.equal({
      addOne: {
        params: ['a'],
        steps: [
          {
            assign1: {
              assign: [{ res: '${a + 1}' }],
            },
          },
          {
            return1: {
              return: '${res}',
            },
          },
        ],
      },
    })
  })
})

describe('Assign statement parsing', () => {
  it('parses assignment statements without errors', () => {
    const block1 = 'first_name_1 = "Tiabeanie"'
    const ast = parseOneRule(block1, (p) => p.assignmentStatement())

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ first_name_1: 'Tiabeanie' }],
    })
  })

  it('disambiguates keywords from identifiers', () => {
    // The prefix "false" in "falseValue" should not be parsed as the boolean value false.
    const block = 'falseValue = False'
    const ast = parseOneRule(block, (p) => p.assignmentStatement())

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ falseValue: false }],
    })
  })

  it('parses multiple assignment statements into one assign step', () => {
    const block = `
    firstName = "Tiabeanie"
    middleName = "Mariabeanie"
    familyName = "de la Rochambeaux Grunkwitz"
    `
    const ast = parseOneRule(block, (p) => p.assignmentStatement())

    expect(ast.step?.render()).to.deep.equal({
      assign: [
        { firstName: 'Tiabeanie' },
        { middleName: 'Mariabeanie' },
        { familyName: 'de la Rochambeaux Grunkwitz' },
      ],
    })
  })
})

describe('Call statement parsing', () => {
  it('parses call statement without arguments', () => {
    const block = `anotherWorkflow()`

    const ast = parseOneRule(block, (p) => p.statement())

    expect(ast.step?.render()).to.deep.equal({
      call: 'anotherWorkflow',
    })
  })

  it('parses a call with a result assignment', () => {
    const block = `my_result = my_workflow()`

    const ast = parseOneRule(block, (p) => p.statement())

    expect(ast.step?.render()).to.deep.equal({
      call: 'my_workflow',
      result: 'my_result',
    })
  })

  it('parses a call with arguments', () => {
    const block = `product = multiply(firstFactor = 7, secondFactor = 8)`

    const ast = parseOneRule(block, (p) => p.statement())

    expect(ast.step?.render()).to.deep.equal({
      call: 'multiply',
      args: {
        firstFactor: 7,
        secondFactor: 8,
      },
      result: 'product',
    })
  })
})

function parseOneRule(
  codeBlock: string,
  parseRule: (parser: WorfkflowScriptParser) => CstNode,
) {
  const parser = new WorfkflowScriptParser()
  const visitor = createVisitor(parser)

  const lexResult = workflowScriptLexer.tokenize(codeBlock)
  parser.input = lexResult.tokens

  const cst = parseRule(parser)
  const ast = visitor.visit(cst)

  if (lexResult.errors.length > 0) {
    throw new Error('Lex error: ' + JSON.stringify(lexResult.errors))
  }
  if (parser.errors.length > 0) {
    throw new Error('Parsing error: ' + JSON.stringify(parser.errors))
  }

  return ast
}
