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

  it('assigns to variable with integer subscript', () => {
    const block = `a_list[0] = 1`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list[0]': 1 }],
    })
  })

  it('assigns to variable with a string subscript', () => {
    const block = `a_list["key1"] = 1`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list["key1"]': 1 }],
    })
  })

  /*
  it('assigns to variable with a variable name as the subscript', () => {
    const block = `a_list[idx] = 2`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [
        { 'a_list[idx]': 2 },
      ],
    })
  })
  */

  it('assigns to variable with a complex expression subscript', () => {
    const block = `a_list[\${len(a_list) - 1}] = 3`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list[${len(a_list) - 1}]': 3 }],
    })
  })

  it('assigns to variable with multidimensional subscripts', () => {
    const block = `a_list[2][3] = 4`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list[2][3]': 4 }],
    })
  })

  it('assigns to variable with subscripts and an attribute', () => {
    const block = `a_list[2][3].nested_key = 5`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list[2][3].nested_key': 5 }],
    })
  })

  it('assigns to variable with a nested key', () => {
    const block = `a_map.key1 = 6`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_map.key1': 6 }],
    })
  })

  it('assigns to variable with multiple levels of nested keys', () => {
    const block = `a_map.key1.key2 = 7`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_map.key1.key2': 7 }],
    })
  })

  it('assigns to variable with nested key and a subscript', () => {
    const block = `a_map.nested_list[0] = 8`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_map.nested_list[0]': 8 }],
    })
  })

  it('assigns to variable with multiple keys and subscripts', () => {
    const block = `a_map.nested_list[0].nested_key2[1] = 9`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_map.nested_list[0].nested_key2[1]': 9 }],
    })
  })

  it('parsing fails if subscripts are floating point number', () => {
    const block = `a_list[4.5] = 9`

    expect(() => parseStatement(block)).to.throw()
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
      http.post(url = "https://forums.dreamland.test/register/bean")
    }
    branch {
      http.post(url = "https://forums.dreamland.test/register/elfo")
    }
    branch {
      http.post(url = "https://forums.dreamland.test/register/luci")
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
                      url: 'https://forums.dreamland.test/register/bean',
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
                      url: 'https://forums.dreamland.test/register/elfo',
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
                      url: 'https://forums.dreamland.test/register/luci',
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

  it('parses parallel branches with optional parameters', () => {
    const block = `
    parallel (
      shared = ["numPosts"],
      concurrency_limit = 2,
      exception_policy = "continueAll"
    )
    branch {
      n = http.get(url = "https://forums.dreamland.test/numPosts/bean")
      numPosts = \${numPosts + n}
    }
    branch {
      n = http.get(url = "https://forums.dreamland.test/numPosts/elfo")
      numPosts = \${numPosts + n}
    }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      parallel: {
        shared: ['numPosts'],
        exception_policy: 'continueAll',
        concurrency_limit: 2,
        branches: [
          {
            branch1: {
              steps: [
                {
                  call1: {
                    call: 'http.get',
                    args: {
                      url: 'https://forums.dreamland.test/numPosts/bean',
                    },
                    result: 'n',
                  },
                },
                {
                  assign1: {
                    assign: [{ numPosts: '${numPosts + n}' }],
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
                    call: 'http.get',
                    args: {
                      url: 'https://forums.dreamland.test/numPosts/elfo',
                    },
                    result: 'n',
                  },
                },
                {
                  assign2: {
                    assign: [{ numPosts: '${numPosts + n}' }],
                  },
                },
              ],
            },
          },
        ],
      },
    })
  })

  it('throws on unknown optional parameters', () => {
    const block = `
    parallel (
      shared = ["numPosts"],
      this_is_an_unknown_parameter = true
    )
    branch {
      n = http.get(url = "https://forums.dreamland.test/numPosts/bean")
      numPosts = \${numPosts + n}
    }
    branch {
      n = http.get(url = "https://forums.dreamland.test/numPosts/elfo")
      numPosts = \${numPosts + n}
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('"parallel" must be followed by a "branch"', () => {
    const block = `
    parallel (shared = ["numPosts"])

    n = http.get(url = "https://forums.dreamland.test/numPosts/bean")
    numPosts = \${numPosts + n}
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('"branch" must be preceeded by "parallel"', () => {
    const block = `
    numPosts = 0

    branch {
      n = http.get(url = "https://forums.dreamland.test/numPosts/bean")
      numPosts = \${numPosts + n}
    }
    branch {
      n = http.get(url = "https://forums.dreamland.test/numPosts/elfo")
      numPosts = \${numPosts + n}
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })
})

describe('Try-catch statement parsing', () => {
  it('parses try-catch without errors', () => {
    const block = `
    try {
      response = http.get(url = "https://visit.dreamland.test/")
    } catch (err) {
      if (\${err.code == 404}) {
        return "Not found"
      }
    }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      try: {
        steps: [
          {
            call1: {
              call: 'http.get',
              args: {
                url: 'https://visit.dreamland.test/',
              },
              result: 'response',
            },
          },
        ],
      },
      except: {
        as: 'err',
        steps: [
          {
            switch1: {
              switch: [
                {
                  condition: '${err.code == 404}',
                  steps: [
                    {
                      return1: {
                        return: 'Not found',
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    })
  })

  it('throws on try without catch', () => {
    const block = `
    try {
      response = http.get(url = "https://visit.dreamland.test/")
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })
})

describe('Expression parsing', () => {
  it('parses escaped quotes correctly', () => {
    const s = '"Tiabeanie \\"Bean\\" Mariabeanie de la Rochambeaux Grunkwitz"'

    expect(parseExpression(s)).to.equal(
      'Tiabeanie "Bean" Mariabeanie de la Rochambeaux Grunkwitz',
    )
  })

  it('parses escaped tabs correctly', () => {
    const s = '"Bean\\tElfo\\tLuci"'

    expect(parseExpression(s)).to.equal('Bean\tElfo\tLuci')
  })

  it('parses escaped line feeds', () => {
    const s = '"Dagmar\\nOona"'

    expect(parseExpression(s)).to.equal('Dagmar\nOona')
  })

  it('parses escaped backslashes', () => {
    const s = '"Mop Girl\\\\Miri"'

    expect(parseExpression(s)).to.equal('Mop Girl\\Miri')
  })

  it('parses unicode character references', () => {
    const s = '"King Z\\u00f8g"'

    expect(parseExpression(s)).to.equal('King Zøg')
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

const parseExpression = (codeBlock: string) =>
  parseOneRule(codeBlock, (p) => p.expression())
const parseStatement = (codeBlock: string) =>
  parseOneRule(codeBlock, (p) => p.statement())
const parseSubworkflow = (codeBlock: string) =>
  parseOneRule(codeBlock, (p) => p.subworkflowDefinition())
