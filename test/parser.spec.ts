import { expect } from 'chai'
import { CstNode } from 'chevrotain'
import { workflowScriptLexer } from '../src/lexer.js'
import { WorfkflowScriptParser, createVisitor } from '../src/parser.js'

describe('workflow definition parsing', () => {
  it('parses empty subworkflow definition', () => {
    const block = 'workflow main() { }'
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [],
      },
    })
  })

  it('parses subworkflow definition with parameters', () => {
    const block = 'workflow mySubworkflow(width, height) { }'
    const ast = parseSubworkflow(block)

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
    const ast = parseSubworkflow(block)

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
    const ast = parseStatement(block1)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ first_name_1: 'Tiabeanie' }],
    })
  })

  it('disambiguates keywords from identifiers', () => {
    // The prefix "false" in "falseValue" should not be parsed as the boolean value false.
    const block = 'falseValue = False'
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ falseValue: false }],
    })
  })

  it('combines multiple assignment statements into one assign step', () => {
    const block = `
    workflow test1() {
      firstName = "Tiabeanie"
      middleName = "Mariabeanie"
      familyName = "de la Rochambeaux Grunkwitz"
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      test1: {
        steps: [
          {
            assign1: {
              assign: [
                { firstName: 'Tiabeanie' },
                { middleName: 'Mariabeanie' },
                { familyName: 'de la Rochambeaux Grunkwitz' },
              ],
            },
          },
        ],
      },
    })
  })

  it('splits combined assignment steps and call steps', () => {
    const block = `
    workflow test1() {
      a = 1
      b = 2
      result = anotherWorkflow()
      c = 3
      d = 4
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      test1: {
        steps: [
          {
            assign1: {
              assign: [{ a: 1 }, { b: 2 }],
            },
          },
          {
            call1: {
              call: 'anotherWorkflow',
              result: 'result',
            },
          },
          {
            assign3: {
              assign: [{ c: 3 }, { d: 4 }],
            },
          },
        ],
      },
    })
  })
})

describe('Call statement parsing', () => {
  it('parses call statement without assigning the return value', () => {
    const block = `anotherWorkflow()`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      call: 'anotherWorkflow',
    })
  })

  it('parses a call with a result assignment', () => {
    const block = `my_result = my_workflow()`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      call: 'my_workflow',
      result: 'my_result',
    })
  })

  it('parses a call with arguments', () => {
    const block = `product = multiply(firstFactor = 7, secondFactor = 8)`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      call: 'multiply',
      args: {
        firstFactor: 7,
        secondFactor: 8,
      },
      result: 'product',
    })
  })

  it('parses a standard library function call', () => {
    const block = `htmlPage = http.get(url = "https://visit.dreamland.test/things-to-do")`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      call: 'http.get',
      args: {
        url: 'https://visit.dreamland.test/things-to-do',
      },
      result: 'htmlPage',
    })
  })
})

describe('If statement parsing', () => {
  it('parses if statement without an else branch', () => {
    const block = `
    if (\${nickname == ""}) {
      nickname = "Bean"
    }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      switch: [
        {
          condition: '${nickname == ""}',
          steps: [
            {
              assign1: {
                assign: [{ nickname: 'Bean' }],
              },
            },
          ],
        },
      ],
    })
  })

  it('parses if statement with an else branch', () => {
    const block = `
    if (\${name == "Oona"}) {
      isPirate = true
    } else {
      isPirate = false
    }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      switch: [
        {
          condition: '${name == "Oona"}',
          steps: [
            {
              assign1: {
                assign: [{ isPirate: true }],
              },
            },
          ],
        },
        {
          condition: true,
          steps: [
            {
              assign2: {
                assign: [{ isPirate: false }],
              },
            },
          ],
        },
      ],
    })
  })

  it('parses if statement multiple branches', () => {
    const block = `
    if (\${name == "Mora"}) {
      homeland = "Mermaid Island"
    } else if (\${name == "Alva Gunderson"}) {
      homeland = "Steamland"
    } else {
      homeland = "Dreamland"
    }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      switch: [
        {
          condition: '${name == "Mora"}',
          steps: [
            {
              assign1: {
                assign: [{ homeland: 'Mermaid Island' }],
              },
            },
          ],
        },
        {
          condition: '${name == "Alva Gunderson"}',
          steps: [
            {
              assign2: {
                assign: [{ homeland: 'Steamland' }],
              },
            },
          ],
        },
        {
          condition: true,
          steps: [
            {
              assign3: {
                assign: [{ homeland: 'Dreamland' }],
              },
            },
          ],
        },
      ],
    })
  })
})

describe('Parallel step parsing', () => {
  it('parses parallel branches', () => {
    const block = `
    parallel branch {
      http.post(url = "https://forum.dreamland.test/register/bean")
    }
    branch {
      http.post(url = "https://forum.dreamland.test/register/elfo")
    }
    branch {
      http.post(url = "https://forum.dreamland.test/register/luci")
    }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      parallel: {
        branches: [
          {
            branch1: {
              steps: [
                {
                  call1: {
                    call: 'http.post',
                    args: {
                      url: 'https://forum.dreamland.test/register/bean',
                    },
                  },
                },
              ],
            },
          },
          {
            branch2: {
              steps: [
                {
                  call2: {
                    call: 'http.post',
                    args: {
                      url: 'https://forum.dreamland.test/register/elfo',
                    },
                  },
                },
              ],
            },
          },
          {
            branch3: {
              steps: [
                {
                  call3: {
                    call: 'http.post',
                    args: {
                      url: 'https://forum.dreamland.test/register/luci',
                    },
                  },
                },
              ],
            },
          },
        ],
      },
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

const parseStatement = (codeBlock: string) =>
  parseOneRule(codeBlock, (p) => p.statement())
const parseSubworkflow = (codeBlock: string) =>
  parseOneRule(codeBlock, (p) => p.subworkflowDefinition())
