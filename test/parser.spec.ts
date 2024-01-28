import { expect } from 'chai'
import { parseStatement, parseSubworkflow, cstVisitor } from './testutils.js'

beforeEach(() => {
  cstVisitor.reset()
})

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

  it('subworkflow parameter default values must be literals', () => {
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

  it('assigns to variable with a variable name as the subscript', () => {
    const block = `a_list[idx] = 2`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list[idx]': 2 }],
    })
  })

  it('assigns to variable with a complex expression subscript', () => {
    const block = `a_list[len(a_list) - 1] = 3`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ 'a_list[len(a_list) - 1]': 3 }],
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

  it('assigns an expression value', () => {
    const block = `res = a + 1`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ res: '${a + 1}' }],
    })
  })

  it('assigns a call expression value', () => {
    const block = `res = default(value, "")`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ res: '${default(value, "")}' }],
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
      assign: [{ my_result: '${my_workflow()}' }],
    })
  })

  it('parses a call with arguments', () => {
    const block = `product = multiply(7, 8)`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [{ product: '${multiply(7, 8)}' }],
    })
  })

  it('parses a call with arguments but without result variable', () => {
    const block = `log.sys(text = "Hello log")`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      call: 'log.sys',
      args: {
        text: 'Hello log',
      },
    })
  })

  it('parses a standard library function call', () => {
    const block = `htmlPage = http.get("https://visit.dreamland.test/things-to-do")`
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      assign: [
        {
          htmlPage: '${http.get("https://visit.dreamland.test/things-to-do")}',
        },
      ],
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
    if (name == "Oona") {
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
    if (name == "Mora") {
      homeland = "Mermaid Island"
    } else if (name == "Alva Gunderson") {
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
      n = http.get("https://forums.dreamland.test/numPosts/bean")
      numPosts = numPosts + n
    }
    branch {
      n = http.get("https://forums.dreamland.test/numPosts/elfo")
      numPosts = numPosts + n
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
                  assign3: {
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

  it('"parallel" must be followed by a "branch"', () => {
    const block = `
    parallel (shared = ["numPosts"])

    n = http.get("https://forums.dreamland.test/numPosts/bean")
    numPosts = numPosts + n
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

    expect(ast.step?.render()).to.deep.equal({
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

    expect(ast.step?.render()).to.deep.equal({
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
    retry (predicate = http.default_retry_predicate, maxRetries = 10, initialDelay = 3.0, maxDelay = 60, multiplier = 1.5)
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
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

    expect(ast.step?.render()).to.deep.equal({
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
    retry (predicate = http.default_retry_predicate, maxRetries = 10)
    `

    expect(() => parseStatement(block)).to.throw()
  })

  it('throws an error if both default and custom retry policy are defined', () => {
    const block = `
    try {
      response = http.get("https://visit.dreamland.test/")
    }
    retry (policy = http.default_retry, predicate = http.default_retry_predicate, maxRetries = 10, initialDelay = 3, maxDelay = 60, multiplier = 2)
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

    expect(ast.step?.render()).to.deep.equal({
      raise: 'Error!',
    })
  })

  it('parses throw with an expression', () => {
    const block = `
    throw exception
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
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

    expect(ast.step?.render()).to.deep.equal({
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

    expect(ast.step?.render()).to.deep.equal({
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

    expect(ast.step?.render()).to.deep.equal({
      for: {
        value: 'key',
        in: '${keys(map)}',
        steps: [
          {
            assign1: {
              assign: [{ total: '${total + map[key]}' }],
            },
          },
        ],
      },
    })
  })

  it('parses a for loop with an empty body', () => {
    const block = `
    for (x in [1, 2, 3]) { }
    `
    const ast = parseStatement(block)

    expect(ast.step?.render()).to.deep.equal({
      for: {
        value: 'x',
        in: [1, 2, 3],
        steps: [],
      },
    })
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

    expect(ast.step?.render()).to.deep.equal({
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
                      continue1: {
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

    expect(ast.step?.render()).to.deep.equal({
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
                      break1: {
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

  it('fails to parse for in number', () => {
    const block = `
    for (x in 999) { }
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
