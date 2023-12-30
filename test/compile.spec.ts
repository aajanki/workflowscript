import { expect } from 'chai'
import { compile } from '../src/compile.js'
import * as YAML from 'yaml'

describe('WorkflowScript compiler', () => {
  it('compiles simple workflow', () => {
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
})
