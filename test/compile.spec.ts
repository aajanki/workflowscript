import { expect } from 'chai'
import * as fs from 'node:fs'
import { join } from 'node:path'
import * as YAML from 'yaml'
import { compile, compileFile } from '../src/compile.js'

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
      greeting = makeGreeting(name)
    }

    workflow makeGreeting(name) {
      greeting = "Hello " + name
      return greeting
    }
    `

    const compiled = compile(program)

    const expected = YAML.parse(`
    main:
        steps:
          - assign1:
              assign:
                - name: "Elfo"
                - greeting: "\${makeGreeting(name)}"

    makeGreeting:
        params: [name]
        steps:
          - assign3:
              assign:
                - greeting: \${"Hello " + name}
          - return1:
              return: \${greeting}
    `)

    expect(YAML.parse(compiled)).to.deep.equal(expected)
  })

  it('compiles examples without errors', () => {
    const sampleDir = 'examples'
    fs.readdirSync(sampleDir).forEach((fname) => {
      const path = join(sampleDir, fname)
      if (path.endsWith('.wfs') && !fs.statSync(path).isDirectory()) {
        expect(() => compileFile(path)).not.to.throw()
      }
    })
  })

  it('throws on syntax errors', () => {
    const program = `
    workflow main() {
      name = "Elfo"

      !!!***

      greeting = makeGreeting(name = name)
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

  it('ignores single-line comments', () => {
    const program = `// Single line comments
    workflow main() {
      // Going to define a variable
      a = 1 // <-- Defining a variable here
      // Variable is now defined
    }`

    const compiled = compile(program)

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `)

    expect(YAML.parse(compiled)).to.deep.equal(expected)
  })

  it('throws validation errors', () => {
    const program = `
    workflow greetings() {
      return "Hello"
    }

    workflow greetings() {
      return "Hi"
    }
    `

    expect(() => compile(program)).to.throw('duplicatedSubworkflowName')
  })
})
