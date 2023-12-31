import { expect } from 'chai'
import { compile } from '../src/compile.js'
import * as YAML from 'yaml'

describe('WorkflowScript compiler', () => {
  it('compiles an empty workflow', () => {
    const compiled = compile('')

    expect(YAML.parse(compiled)).to.be.empty
  })

  it('compiles a simple workflow', () => {
    const simple = `
    workflow main() {
      a = 1
    }`

    const compiled = compile(simple)

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `)

    expect(YAML.parse(compiled)).to.deep.equal(expected)
  })

  it('compiles a program with multiple subworkflows', () => {
    const program = `
    workflow main() {
      name = "Elfo"
      greeting = makeGreeting(name = \${name})
    }

    workflow makeGreeting(name) {
      greeting = \${"Hello " + name}
      return \${greeting}
    }
    `

    const compiled = compile(program)

    const expected = YAML.parse(`
    main:
        steps:
          - assign1:
              assign:
                - name: "Elfo"

          - call1:
              call: makeGreeting
              args:
                  name: \${name}
              result: greeting

    makeGreeting:
        params: [name]
        steps:
          - assign2:
              assign:
                - greeting: \${"Hello " + name}
          - return1:
              return: \${greeting}
    `)

    expect(YAML.parse(compiled)).to.deep.equal(expected)
  })

  it('throws on syntax errors', () => {
    const program = `
    workflow main() {
      name = "Elfo"

      !!!***

      greeting = makeGreeting(name = \${name})
    }
    `
    expect(() => compile(program)).to.throw
  })

  it('throws on incomplete workflow definition', () => {
    const program = `
    workflow main() {
      name = "Elfo"
    `
    expect(() => compile(program)).to.throw
  })

  it('rejects top level statements', () => {
    const program = `
    name = "Elfo"
    `
    expect(() => compile(program)).to.throw
  })
})
