import { expect } from 'chai'
import {
  parseExpression,
  parseStatement,
  parseSubworkflow,
  primitiveEx,
  renderASTStep,
  valueExpression,
} from './testutils.js'
import {
  AssignStepAST,
  CallStepAST,
  ForStepAST,
  NextStepAST,
  ParallelStepAST,
  RaiseStepAST,
  ReturnStepAST,
  StepsStepAST,
  SwitchStepAST,
  TryStepAST,
} from '../src/ast/steps.js'
import {
  FunctionInvocation,
  VariableReference,
} from '../src/ast/expressions.js'

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

  it('parses subworkflow definition with optional parameters', () => {
    const block = 'workflow mySubworkflow(color, age=42) { }'
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      mySubworkflow: {
        params: ['color', { age: 42 }],
        steps: [],
      },
    })
  })

  it('subworkflow parameter default values must be simple literals', () => {
    const block = 'workflow mySubworkflow(color, age=[1, 2]) { }'
    expect(() => parseSubworkflow(block)).to.throw()
  })

  it('parses subworkflow definition with body', () => {
    const block = `workflow addOne(a) {
      res = a + 1
      return res
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

  it('try-retry regression test 1', () => {
    const block = `
    workflow main() {
      try {
        a = 1
      }
      retry (predicate=http.default_retry_predicate, max_retries = 6, initial_delay=1, max_delay = 100, multiplier=2.0)
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            try1: {
              try: {
                steps: [
                  {
                    assign1: {
                      assign: [{ a: 1 }],
                    },
                  },
                ],
              },
              retry: {
                predicate: '${http.default_retry_predicate}',
                max_retries: 6,
                backoff: {
                  initial_delay: 1,
                  max_delay: 100,
                  multiplier: 2.0,
                },
              },
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

    expect(ast).to.deep.equal([
      new AssignStepAST([['first_name_1', primitiveEx('Tiabeanie')]]),
    ])
  })

  it('assigns to variable with integer subscript', () => {
    const block = `a_list[0] = 1`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_list[0]', primitiveEx(1)]]),
    ])
  })

  it('assigns to variable with a string subscript', () => {
    const block = `a_list["key1"] = 1`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_list["key1"]', primitiveEx(1)]]),
    ])
  })

  it('assigns to variable with a variable name as the subscript', () => {
    const block = `a_list[idx] = 2`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_list[idx]', primitiveEx(2)]]),
    ])
  })

  it('assigns to variable with a complex expression subscript', () => {
    const block = `a_list[len(a_list) - 1] = 3`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_list[len(a_list) - 1]', primitiveEx(3)]]),
    ])
  })

  it('assigns to variable with multidimensional subscripts', () => {
    const block = `a_list[2][3] = 4`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_list[2][3]', primitiveEx(4)]]),
    ])
  })

  it('assigns to variable with subscripts and an attribute', () => {
    const block = `a_list[2][3].nested_key = 5`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_list[2][3].nested_key', primitiveEx(5)]]),
    ])
  })

  it('assigns to variable with a nested key', () => {
    const block = `a_map.key1 = 6`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_map.key1', primitiveEx(6)]]),
    ])
  })

  it('assigns to variable with multiple levels of nested keys', () => {
    const block = `a_map.key1.key2 = 7`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_map.key1.key2', primitiveEx(7)]]),
    ])
  })

  it('assigns to variable with nested key and a subscript', () => {
    const block = `a_map.nested_list[0] = 8`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['a_map.nested_list[0]', primitiveEx(8)]]),
    ])
  })

  it('assigns to variable with multiple keys and subscripts', () => {
    const block = `a_map.nested_list[0].nested_key2[1] = 9`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        ['a_map.nested_list[0].nested_key2[1]', primitiveEx(9)],
      ]),
    ])
  })

  it('parsing fails if subscripts are floating point number', () => {
    const block = `a_list[4.5] = 9`

    expect(() => parseStatement(block)).to.throw()
  })

  it('assigns an expression value', () => {
    const block = `res = a + 1`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['res', parseExpression('a + 1')]]),
    ])
  })

  it('assigns a call expression value', () => {
    const block = `res = default(value, "")`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        [
          'res',
          valueExpression(
            new FunctionInvocation('default', [
              valueExpression(new VariableReference('value')),
              primitiveEx(''),
            ]),
          ),
        ],
      ]),
    ])
  })

  it('disambiguates keywords from identifiers', () => {
    // The prefix "false" in "falseValue" should not be parsed as the boolean value false.
    const block = 'falseValue = False'
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([['falseValue', primitiveEx(false)]]),
    ])
  })

  it('renders an assignment step', () => {
    const ast = new AssignStepAST([
      ['idx', primitiveEx(1)],
      ['a_list[idx][0]', primitiveEx(2)],
    ])

    const rendered = renderASTStep(ast)

    expect(rendered).to.deep.equal({
      assign: [
        {
          idx: 1,
        },
        {
          'a_list[idx][0]': 2,
        },
      ],
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
})

describe('Call statement parsing', () => {
  it('parses call statement without assigning the return value', () => {
    const block = `anotherWorkflow()`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([new CallStepAST('anotherWorkflow')])
  })

  it('parses a call with a result assignment', () => {
    const block = `my_result = my_workflow()`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        [
          'my_result',
          valueExpression(new FunctionInvocation('my_workflow', [])),
        ],
      ]),
    ])
  })

  it('parses a call with arguments', () => {
    const block = `product = multiply(7, 8)`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        [
          'product',
          valueExpression(
            new FunctionInvocation('multiply', [
              primitiveEx(7),
              primitiveEx(8),
            ]),
          ),
        ],
      ]),
    ])
  })

  it('parses a call assigned to a subscripted and nested result variable', () => {
    const block = `values[1].result = my_workflow()`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        [
          'values[1].result',
          valueExpression(new FunctionInvocation('my_workflow', [])),
        ],
      ]),
    ])
  })

  it('parses a call with parameters assigned to a subscripted and nested result variable', () => {
    const block = `results[0].multiplication.product = multiply(7, 8)`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        [
          'results[0].multiplication.product',
          valueExpression(
            new FunctionInvocation('multiply', [
              primitiveEx(7),
              primitiveEx(8),
            ]),
          ),
        ],
      ]),
    ])
  })

  it('parses a call with named parameters assigned to a subscripted and nested result variable', () => {
    const block = `projects[0].id = sys.get_env(name="GOOGLE_CLOUD_PROJECT_ID", default="1")`
    const ast = parseStatement(block)
    const res = ast.map(renderASTStep)

    expect(res).to.deep.equal([
      {
        call: 'sys.get_env',
        args: {
          name: 'GOOGLE_CLOUD_PROJECT_ID',
          default: '1',
        },
        result: '__temp',
      },
      {
        assign: [{ 'projects[0].id': '${__temp}' }],
      },
    ])
  })

  it('parses a call with arguments but without result variable', () => {
    const block = `sys.log(text = "Hello log")`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new CallStepAST('sys.log', { text: primitiveEx('Hello log') }),
    ])
  })

  it('parses a standard library function call', () => {
    const block = `htmlPage = http.get("https://visit.dreamland.test/things-to-do")`
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new AssignStepAST([
        [
          'htmlPage',
          valueExpression(
            new FunctionInvocation('http.get', [
              primitiveEx('https://visit.dreamland.test/things-to-do'),
            ]),
          ),
        ],
      ]),
    ])
  })

  it('parses a call with named parameters and expression values', () => {
    const block = 'sys.log(text="Hello " + name)'
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new CallStepAST('sys.log', { text: parseExpression('"Hello " + name') }),
    ])
  })

  it('parses a call with named parameters and result variable', () => {
    const block =
      'page = http.get(url="https://visit.dreamland.test/things-to-do")'
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new CallStepAST(
        'http.get',
        { url: primitiveEx('https://visit.dreamland.test/things-to-do') },
        'page',
      ),
    ])
  })

  it('renders a call with a result assignment', () => {
    const ast = new AssignStepAST([
      ['my_result', valueExpression(new FunctionInvocation('my_workflow', []))],
    ])
    const res = renderASTStep(ast)

    expect(res).to.deep.equal({
      assign: [{ my_result: '${my_workflow()}' }],
    })
  })

  it('renders a call with named parameters and expression values', () => {
    const ast = new CallStepAST(
      'http.get',
      { url: primitiveEx('https://visit.dreamland.test/things-to-do') },
      'page',
    )
    const res = renderASTStep(ast)

    expect(res).to.deep.equal({
      call: 'http.get',
      args: {
        url: 'https://visit.dreamland.test/things-to-do',
      },
      result: 'page',
    })
  })
})

describe('If statement parsing', () => {
  it('parses if statement without an else branch', () => {
    const block = `
    if (nickname == "") {
      nickname = "Bean"
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new SwitchStepAST([
        {
          condition: parseExpression('nickname == ""'),
          steps: [new AssignStepAST([['nickname', primitiveEx('Bean')]])],
        },
      ]),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
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
    if (name == "Oona") {
      isPirate = true
    } else {
      isPirate = false
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new SwitchStepAST([
        {
          condition: parseExpression('name == "Oona"'),
          steps: [new AssignStepAST([['isPirate', primitiveEx(true)]])],
        },
        {
          condition: primitiveEx(true),
          steps: [new AssignStepAST([['isPirate', primitiveEx(false)]])],
        },
      ]),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
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
    if (name == "Mora") {
      homeland = "Mermaid Island"
    } else if (name == "Alva Gunderson") {
      homeland = "Steamland"
    } else {
      homeland = "Dreamland"
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new SwitchStepAST([
        {
          condition: parseExpression('name == "Mora"'),
          steps: [
            new AssignStepAST([['homeland', primitiveEx('Mermaid Island')]]),
          ],
        },
        {
          condition: parseExpression('name == "Alva Gunderson"'),
          steps: [new AssignStepAST([['homeland', primitiveEx('Steamland')]])],
        },
        {
          condition: primitiveEx(true),
          steps: [new AssignStepAST([['homeland', primitiveEx('Dreamland')]])],
        },
      ]),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
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

    expect(ast).to.deep.equal([
      new ParallelStepAST({
        branch1: new StepsStepAST([
          new CallStepAST('http.post', {
            url: primitiveEx('https://forums.dreamland.test/register/bean'),
          }),
        ]),
        branch2: new StepsStepAST([
          new CallStepAST('http.post', {
            url: primitiveEx('https://forums.dreamland.test/register/elfo'),
          }),
        ]),
        branch3: new StepsStepAST([
          new CallStepAST('http.post', {
            url: primitiveEx('https://forums.dreamland.test/register/luci'),
          }),
        ]),
      }),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
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
      n = http.get("https://forums.dreamland.test/numPosts/bean")
      numPosts = numPosts + n
    }
    branch {
      n = http.get("https://forums.dreamland.test/numPosts/elfo")
      numPosts = numPosts + n
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ParallelStepAST(
        {
          branch1: new StepsStepAST([
            new AssignStepAST([
              [
                'n',
                parseExpression(
                  'http.get("https://forums.dreamland.test/numPosts/bean")',
                ),
              ],
              ['numPosts', parseExpression('numPosts + n')],
            ]),
          ]),
          branch2: new StepsStepAST([
            new AssignStepAST([
              [
                'n',
                parseExpression(
                  'http.get("https://forums.dreamland.test/numPosts/elfo")',
                ),
              ],
              ['numPosts', parseExpression('numPosts + n')],
            ]),
          ]),
        },
        ['numPosts'],
        2,
        'continueAll',
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      parallel: {
        shared: ['numPosts'],
        exception_policy: 'continueAll',
        concurrency_limit: 2,
        branches: [
          {
            branch1: {
              steps: [
                {
                  assign1: {
                    assign: [
                      {
                        n: '${http.get("https://forums.dreamland.test/numPosts/bean")}',
                      },
                      { numPosts: '${numPosts + n}' },
                    ],
                  },
                },
              ],
            },
          },
          {
            branch2: {
              steps: [
                {
                  assign2: {
                    assign: [
                      {
                        n: '${http.get("https://forums.dreamland.test/numPosts/elfo")}',
                      },
                      { numPosts: '${numPosts + n}' },
                    ],
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
      n = http.get("https://forums.dreamland.test/numPosts/bean")
      numPosts = numPosts + n
    }
    branch {
      n = http.get("https://forums.dreamland.test/numPosts/elfo")
      numPosts = numPosts + n
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('"parallel" must be followed by a "branch" or "for"', () => {
    const block = `
    parallel (shared = ["numPosts"]) {
      n = http.get("https://forums.dreamland.test/numPosts/bean")
      numPosts = numPosts + n
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('"branch" must be preceeded by "parallel"', () => {
    const block = `
    numPosts = 0

    branch {
      n = http.get("https://forums.dreamland.test/numPosts/bean")
      numPosts = numPosts + n
    }
    branch {
      n = http.get("https://forums.dreamland.test/numPosts/elfo")
      numPosts = numPosts + n
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })
})

describe('Parallel iteration', () => {
  it('parses parallel iteration', () => {
    const block = `
    parallel for (username in ["bean", "elfo", "luci"]) {
      http.post(url = "https://forum.dreamland.test/register/" + username)
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ParallelStepAST(
        new ForStepAST(
          [
            new CallStepAST('http.post', {
              url: parseExpression(
                '"https://forum.dreamland.test/register/" + username',
              ),
            }),
          ],
          'username',
          parseExpression('["bean", "elfo", "luci"]'),
        ),
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      parallel: {
        for: {
          value: 'username',
          in: ['bean', 'elfo', 'luci'],
          steps: [
            {
              call1: {
                call: 'http.post',
                args: {
                  url: '${"https://forum.dreamland.test/register/" + username}',
                },
              },
            },
          ],
        },
      },
    })
  })

  it('parses parallel iteration with shared variable', () => {
    const block = `
    parallel (shared = ["total"])
    for (i in [1, 2, 3, 4]) {
      total = total + i
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ParallelStepAST(
        new ForStepAST(
          [new AssignStepAST([['total', parseExpression('total + i')]])],
          'i',
          parseExpression('[1, 2, 3, 4]'),
        ),
        ['total'],
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      parallel: {
        shared: ['total'],
        for: {
          value: 'i',
          in: [1, 2, 3, 4],
          steps: [
            {
              assign1: {
                assign: [{ total: '${total + i}' }],
              },
            },
          ],
        },
      },
    })
  })
})

describe('Try-retry-catch statement parsing', () => {
  it('parses try-catch without errors', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    } catch (err) {
      if (err.code == 404) {
        return "Not found"
      }
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new TryStepAST(
        [
          new AssignStepAST([
            [
              'response',
              parseExpression('http.get("https://visit.dreamland.test/")'),
            ],
          ]),
        ],
        [
          new SwitchStepAST([
            {
              condition: parseExpression('err.code == 404'),
              steps: [new ReturnStepAST(primitiveEx('Not found'))],
            },
          ]),
        ],
        undefined,
        'err',
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      try: {
        steps: [
          {
            assign1: {
              assign: [
                { response: '${http.get("https://visit.dreamland.test/")}' },
              ],
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

  it('parses a try with a default retry policy without errors', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    } retry (policy = http.default_retry)
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new TryStepAST(
        [
          new AssignStepAST([
            [
              'response',
              parseExpression('http.get("https://visit.dreamland.test/")'),
            ],
          ]),
        ],
        [],
        'http.default_retry',
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      try: {
        steps: [
          {
            assign1: {
              assign: [
                { response: '${http.get("https://visit.dreamland.test/")}' },
              ],
            },
          },
        ],
      },
      retry: '${http.default_retry}',
    })
  })

  it('parses a try with a custom retry policy without errors', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = http.default_retry_predicate, max_retries = 10, initial_delay = 3.0, max_delay = 60, multiplier = 1.5)
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new TryStepAST(
        [
          new AssignStepAST([
            [
              'response',
              parseExpression('http.get("https://visit.dreamland.test/")'),
            ],
          ]),
        ],
        [],
        {
          predicate: 'http.default_retry_predicate',
          maxRetries: 10,
          backoff: {
            initialDelay: 3.0,
            maxDelay: 60,
            multiplier: 1.5,
          },
        },
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      try: {
        steps: [
          {
            assign1: {
              assign: [
                { response: '${http.get("https://visit.dreamland.test/")}' },
              ],
            },
          },
        ],
      },
      retry: {
        predicate: '${http.default_retry_predicate}',
        max_retries: 10,
        backoff: {
          initial_delay: 3.0,
          max_delay: 60,
          multiplier: 1.5,
        },
      },
    })
  })

  it('parses a try-retry-catch without errors', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (policy = http.default_retry)
    catch (err) {
      if (err.code == 404) {
        return "Not found"
      }
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new TryStepAST(
        [
          new AssignStepAST([
            [
              'response',
              parseExpression('http.get("https://visit.dreamland.test/")'),
            ],
          ]),
        ],
        [
          new SwitchStepAST([
            {
              condition: parseExpression('err.code == 404'),
              steps: [new ReturnStepAST(primitiveEx('Not found'))],
            },
          ]),
        ],
        'http.default_retry',
        'err',
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      try: {
        steps: [
          {
            assign1: {
              assign: [
                { response: '${http.get("https://visit.dreamland.test/")}' },
              ],
            },
          },
        ],
      },
      retry: '${http.default_retry}',
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

  it('throws if a retry policy is not defined', () => {
    const block1 = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry
    `

    const block2 = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry ()
    `

    expect(() => parseStatement(block1)).to.throw()
    expect(() => parseStatement(block2)).to.throw()
  })

  it('throws an error if custom retry policy is only partially defined', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = http.default_retry_predicate, max_retries = 10)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if both default and custom retry policy are defined', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (policy = http.default_retry, predicate = http.default_retry_predicate, max_retries = 10, initial_delay = 3, max_delay = 60, multiplier = 2)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if custom retry policy predicate is not a fully qualified name', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = "http.default_retry_predicate", max_retries = 10, initial_delay = 3.0, max_delay = 60, multiplier = 1.5)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if custom retry policy max_retries is not a number', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = http.default_retry_predicate, max_retries = "100", initial_delay = 3.0, max_delay = 60, multiplier = 1.5)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if custom retry policy initial_delay is not a number', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = http.default_retry_predicate, max_retries = 100, initial_delay = [2, 4, 8], max_delay = 60, multiplier = 1.5)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if custom retry policy max_delay is not a number', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = http.default_retry_predicate, max_retries = 100, initial_delay = 3.0, max_delay = null, multiplier = 1.5)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if custom retry policy multiplier is not a number', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (predicate = http.default_retry_predicate, max_retries = 100, initial_delay = 3.0, max_delay = 60, multiplier = {value: 4})
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws on try without catch', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('try can have only one catch block', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    catch (err) {
      throw err
    }
    catch (err) {
      if (err.code == 404) {
        return "Not found"
      }
    }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('try can have only one retry block', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (policy = http.default_retry)
    retry (policy = http.default_retry)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('parses throw with a string', () => {
    const block = `
    throw "Error!"
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([new RaiseStepAST(primitiveEx('Error!'))])

    expect(renderASTStep(ast[0])).to.deep.equal({
      raise: 'Error!',
    })
  })

  it('parses throw with an expression', () => {
    const block = `
    throw exception
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new RaiseStepAST(valueExpression(new VariableReference('exception'))),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      raise: '${exception}',
    })
  })

  it('parses throw with a map value', () => {
    const block = `
    throw {
      "code": 98,
      "message": "Access denied"
    }
    `
    const ast = parseStatement(block)

    /*
    expect(ast).to.deep.equal([
      new RaiseStepAST(primitiveEx({code: 98, message: 'Access denied'}))
    ])
    */

    expect(renderASTStep(ast[0])).to.deep.equal({
      raise: {
        code: 98,
        message: 'Access denied',
      },
    })
  })
})

describe('For loop parsing', () => {
  it('parses for loop without errors', () => {
    const block = `
    for (x in [1, 2, 3]) {
      total = total + x
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ForStepAST(
        [new AssignStepAST([['total', parseExpression('total + x')]])],
        'x',
        parseExpression('[1, 2, 3]'),
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      for: {
        value: 'x',
        in: [1, 2, 3],
        steps: [
          {
            assign1: {
              assign: [{ total: '${total + x}' }],
            },
          },
        ],
      },
    })
  })

  it('parses a for loop over an list expression', () => {
    const block = `
    for (key in keys(map)) {
      total = total + map[key]
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ForStepAST(
        [new AssignStepAST([['total', parseExpression('total + map[key]')]])],
        'key',
        parseExpression('keys(map)'),
      ),
    ])
  })

  it('parses a for loop with an empty body', () => {
    const block = `
    for (x in [1, 2, 3]) { }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ForStepAST([], 'x', parseExpression('[1, 2, 3]')),
    ])
  })

  it('parses continue in a for loop', () => {
    const block = `
    for (x in [1, 2, 3, 4]) {
      if (x % 2 == 0) {
        continue
      }

      total = total + x
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ForStepAST(
        [
          new SwitchStepAST([
            {
              condition: parseExpression('x % 2 == 0'),
              steps: [new NextStepAST('continue')],
            },
          ]),
          new AssignStepAST([['total', parseExpression('total + x')]]),
        ],
        'x',
        parseExpression('[1, 2, 3, 4]'),
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      for: {
        value: 'x',
        in: [1, 2, 3, 4],
        steps: [
          {
            switch1: {
              switch: [
                {
                  condition: '${x % 2 == 0}',
                  steps: [
                    {
                      next1: {
                        next: 'continue',
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            assign1: {
              assign: [{ total: '${total + x}' }],
            },
          },
        ],
      },
    })
  })

  it('parses break in a for loop', () => {
    const block = `
    for (x in [1, 2, 3, 4]) {
      if (total > 5) {
        break
      }

      total = total + x
    }
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ForStepAST(
        [
          new SwitchStepAST([
            {
              condition: parseExpression('total > 5'),
              steps: [new NextStepAST('break')],
            },
          ]),
          new AssignStepAST([['total', parseExpression('total + x')]]),
        ],
        'x',
        parseExpression('[1, 2, 3, 4]'),
      ),
    ])

    expect(renderASTStep(ast[0])).to.deep.equal({
      for: {
        value: 'x',
        in: [1, 2, 3, 4],
        steps: [
          {
            switch1: {
              switch: [
                {
                  condition: '${total > 5}',
                  steps: [
                    {
                      next1: {
                        next: 'break',
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            assign1: {
              assign: [{ total: '${total + x}' }],
            },
          },
        ],
      },
    })
  })

  it('fails to parse for in a number', () => {
    const block = `
    for (x in 999) { }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('fails to parse for in a string', () => {
    const block = `
    for (x in "\${fails}") { }
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('fails to parse for in map', () => {
    const block = `
    for (x in {"key": 1}) { }
    `

    expect(() => parseStatement(block)).to.throw()
  })
})

describe('Return statement', () => {
  it('parses a return with a literal succesfully', () => {
    const block = `
    return 0
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([new ReturnStepAST(primitiveEx(0))])
  })

  it('parses a return with a variable succesfully', () => {
    const block = `
    return value
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([
      new ReturnStepAST(valueExpression(new VariableReference('value'))),
    ])
  })

  it('parses a return without a value succesfully', () => {
    const block = `
    return
    `
    const ast = parseStatement(block)

    expect(ast).to.deep.equal([new ReturnStepAST(undefined)])
  })

  it('renders return step', () => {
    const ast = new ReturnStepAST(
      valueExpression(new VariableReference('value')),
    )

    const rendered = renderASTStep(ast)

    expect(rendered).to.deep.equal({
      return: '${value}',
    })
  })
})

describe('Step labels', () => {
  it('labels steps', () => {
    const block = `
    workflow main() {
      // @step-name: initialization
      a = 1
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            initialization: {
              assign: [{ a: 1 }],
            },
          },
        ],
      },
    })
  })

  it('labels only the directly following step', () => {
    const block = `
    workflow main() {
      status = "OK"

      // @step-name: log_status
      sys.log(text=status)

      return status
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            assign1: {
              assign: [{ status: 'OK' }],
            },
          },
          {
            log_status: {
              call: 'sys.log',
              args: {
                text: '${status}',
              },
            },
          },
          {
            return1: {
              return: '${status}',
            },
          },
        ],
      },
    })
  })

  it('allows varying amount of white space', () => {
    const block = `
    workflow main() {
      //@step-name:    initialization
      a = 1
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            initialization: {
              assign: [{ a: 1 }],
            },
          },
        ],
      },
    })
  })

  it('labels branches', () => {
    const block = `
    parallel
    branch {
      a = 1
    }
    // @step-name: another_branch
    branch {
      b = 2
    }
    `
    const ast = parseStatement(block)
    const rendered = renderASTStep(ast[0])

    expect(rendered).to.deep.equal({
      parallel: {
        branches: [
          {
            branch1: {
              steps: [
                {
                  assign1: {
                    assign: [
                      {
                        a: 1,
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            another_branch: {
              steps: [
                {
                  assign2: {
                    assign: [
                      {
                        b: 2,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    })
  })

  it('ignores suffix after the label', () => {
    const block = `
    workflow main() {
      // @step-name: initialization Everything after the label here is a comment!
      a = 1
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            initialization: {
              assign: [{ a: 1 }],
            },
          },
        ],
      },
    })
  })

  it('ignores empty labels', () => {
    const block = `
    workflow main() {
      // @step-name:
      a = 1
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            assign1: {
              assign: [{ a: 1 }],
            },
          },
        ],
      },
    })
  })

  it('ignores labels that are not followed by a statement', () => {
    const block = `
    workflow main() {
      a = 1
      // @step-name: no_step_here
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            assign1: {
              assign: [{ a: 1 }],
            },
          },
        ],
      },
    })
  })

  it('ignores labels before catch', () => {
    const block = `
    workflow main() {
      try {
        a = 1
      }
      // @step-name: catch_does_not_have_a_label
      catch (err) {
        sys.log(text="Error!")
      }
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            try1: {
              try: {
                steps: [
                  {
                    assign1: {
                      assign: [{ a: 1 }],
                    },
                  },
                ],
              },
              except: {
                as: 'err',
                steps: [
                  {
                    call1: {
                      call: 'sys.log',
                      args: {
                        text: 'Error!',
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    })
  })

  it('ignores labels before catch', () => {
    const block = `
    workflow main() {
      try {
        a = 1
      }
      // @step-name: retry_does_not_have_a_label
      retry (policy = http.default_retry)
    }
    `
    const ast = parseSubworkflow(block)

    expect(ast.render()).to.deep.equal({
      main: {
        steps: [
          {
            try1: {
              try: {
                steps: [
                  {
                    assign1: {
                      assign: [{ a: 1 }],
                    },
                  },
                ],
              },
              retry: '${http.default_retry}',
            },
          },
        ],
      },
    })
  })
})
