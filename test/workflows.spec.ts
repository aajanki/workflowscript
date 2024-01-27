import { expect } from 'chai'
import * as YAML from 'yaml'

import { Subworkflow, WorkflowApp, toYAMLString } from '../src/ast/workflows.js'
import { AssignStep, CallStep, namedStep } from '../src/ast/steps.js'
import { parseEx, primitiveEx } from './testutils.js'

describe('workflow AST', () => {
  it('renders a main workflow', () => {
    const steps = [
      namedStep(
        'assign_name',
        new AssignStep([['name', parseEx('args.name')]]),
      ),
      namedStep(
        'say_hello',
        new CallStep('sys.log', {
          text: parseEx('"Hello, " + name'),
        }),
      ),
    ]
    const wf = new Subworkflow('main', steps, [{ name: 'args' }])

    const expected = YAML.parse(`
    main:
        params: [args]
        steps:
          - assign_name:
              assign:
                - name: \${args.name}
          - say_hello:
              call: sys.log
              args:
                  text: \${"Hello, " + name}
    `)

    expect(wf.render()).to.deep.equal(expected)
  })

  it('renders a subworkflow', () => {
    const steps = [
      namedStep(
        'log_greetings',
        new CallStep('sys.log', {
          text: parseEx('greeting + ", " + name'),
        }),
      ),
    ]
    const wf = new Subworkflow('say_hello', steps, [
      { name: 'name' },
      { name: 'greeting', default: 'Hello' },
    ])

    const expected = YAML.parse(`
    say_hello:
        params: [name, greeting: 'Hello']
        steps:
          - log_greetings:
              call: sys.log
              args:
                  text: \${greeting + ", " + name}
    `)

    expect(wf.render()).to.deep.equal(expected)
  })

  it('renders a full workflow', () => {
    const subworkflow = new Subworkflow(
      'say_hello',
      [
        namedStep(
          'log_greetings',
          new CallStep('sys.log', {
            text: parseEx('"Hello, " + name'),
          }),
        ),
      ],
      [{ name: 'name' }],
    )
    const mainWorkflow = new Subworkflow('main', [
      namedStep(
        'call_subworkflow',
        new CallStep(subworkflow.name, {
          name: primitiveEx('Leela'),
        }),
      ),
    ])
    const wf = new WorkflowApp([mainWorkflow, subworkflow])

    const expected = YAML.parse(`
    main:
        steps:
          - call_subworkflow:
              call: say_hello
              args:
                  name: Leela
    say_hello:
        params: [name]
        steps:
          - log_greetings:
              call: sys.log
              args:
                  text: \${"Hello, " + name}
    `)

    expect(wf.render()).to.deep.equal(expected)
  })

  it('outputs the workflow definition in YAML', () => {
    const steps = [
      namedStep(
        'assign_name',
        new AssignStep([['name', parseEx('args.name')]]),
      ),
      namedStep(
        'say_hello',
        new CallStep('sys.log', {
          text: parseEx('"Hello, " + name'),
        }),
      ),
    ]
    const wf = new WorkflowApp([
      new Subworkflow('main', steps, [{ name: 'args' }]),
    ])

    const expected = YAML.parse(`
    main:
        params: [args]
        steps:
          - assign_name:
              assign:
                - name: \${args.name}
          - say_hello:
              call: sys.log
              args:
                  text: \${"Hello, " + name}
    `)

    expect(YAML.parse(toYAMLString(wf))).to.deep.equal(expected)
  })
})
