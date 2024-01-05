import { expect } from 'chai'
import * as YAML from 'yaml'

import { $ } from '../src/ast/variables.js'
import {
  AssignStep,
  CallStep,
  RaiseStep,
  StepsStep,
  SwitchStep,
  TryExceptStep,
  ReturnStep,
  ParallelStep,
  ForStep,
  namedStep,
  SwitchCondition,
} from '../src/ast/steps.js'
import { Subworkflow } from '../src/ast/workflows.js'

describe('workflow step AST', () => {
  it('renders an assign step', () => {
    const step = new AssignStep([
      ['city', 'New New York'],
      ['value', $('1 + 2')],
    ])

    const expected = YAML.parse(`
    assign:
      - city: New New York
      - value: \${1 + 2}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('assigns variables with index notation', () => {
    const step = new AssignStep([
      ['my_list', [0, 1, 2, 3, 4]],
      ['idx', 0],
      ['my_list[0]', 'Value0'],
      ['my_list[idx + 1]', 'Value1'],
      ['my_list[len(my_list) - 1]', 'LastValue'],
    ])

    const expected = YAML.parse(`
    assign:
      - my_list: [0, 1, 2, 3, 4]
      - idx: 0
      - my_list[0]: "Value0"
      - my_list[idx + 1]: "Value1"
      - my_list[len(my_list) - 1]: "LastValue"
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a simple call step', () => {
    const step = new CallStep('destination_step')

    const expected = YAML.parse(`
    call: destination_step
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a call step with arguments and result', () => {
    const step = new CallStep(
      'deliver_package',
      {
        destination: 'Atlanta',
        deliveryCompany: 'Planet Express',
      },
      'deliveryResult',
    )

    const expected = YAML.parse(`
    call: deliver_package
    args:
        destination: Atlanta
        deliveryCompany: Planet Express
    result: deliveryResult
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a call step with an expression as an argument', () => {
    const step = new CallStep('deliver_package', {
      destination: $('destinations[i]'),
    })

    const expected = YAML.parse(`
    call: deliver_package
    args:
        destination: \${destinations[i]}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a switch step', () => {
    const assign1 = namedStep(
      'increase_counter',
      new AssignStep([['a', $('mars_counter + 1')]]),
    )
    const return1 = namedStep('return_counter', new ReturnStep($('a')))
    const { step } = namedStep(
      'step1',
      new SwitchStep(
        [
          new SwitchCondition($('city = "New New York"'), {
            next: 'destination_new_new_york',
          }),
          new SwitchCondition($('city = "Mars Vegas"'), {
            steps: [assign1, return1],
          }),
        ],
        'end',
      ),
    )

    const expected2 = YAML.parse(`
    switch:
        - condition: \${city = "New New York"}
          next: destination_new_new_york
        - condition: \${city = "Mars Vegas"}
          steps:
            - increase_counter:
                assign:
                  - a: \${mars_counter + 1}
            - return_counter:
                return: \${a}
    next: end
    `)

    expect(step.render()).to.deep.equal(expected2)
  })

  it('renders a try step', () => {
    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStep(
        'http.get',
        {
          url: 'https://maybe.failing.test/',
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStep([
        new SwitchCondition($('e.code == 404'), {
          steps: [namedStep('return_error', new ReturnStep('Not found'))],
        }),
      ]),
    )
    const unknownErrors = namedStep('unknown_errors', new RaiseStep($('e')))
    const step = new TryExceptStep(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      undefined,
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a try step with a default retry policy', () => {
    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStep(
        'http.get',
        {
          url: 'https://maybe.failing.test/',
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStep([
        new SwitchCondition($('e.code == 404'), {
          steps: [namedStep('return_error', new ReturnStep('Not found'))],
        }),
      ]),
    )
    const unknownErrors = namedStep('unknown_errors', new RaiseStep($('e')))
    const step = new TryExceptStep(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      'http.default_retry',
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    retry: \${http.default_retry}
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a try step with a custom retry policy', () => {
    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStep(
        'http.get',
        {
          url: 'https://maybe.failing.test/',
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStep([
        new SwitchCondition($('e.code == 404'), {
          steps: [namedStep('return_error', new ReturnStep('Not found'))],
        }),
      ]),
    )
    const unknownErrors = namedStep('unknown_errors', new RaiseStep($('e')))
    const step = new TryExceptStep(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      {
        predicate: 'http.default_retry',
        maxRetries: 10,
        backoff: {
          initialDelay: 0.5,
          maxDelay: 60,
          multiplier: 2,
        },
      },
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    retry:
        predicate: \${http.default_retry}
        max_retries: 10
        backoff:
            initial_delay: 0.5
            max_delay: 60
            multiplier: 2
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a try step with a subworkflow as a retry predicate', () => {
    const predicateSubworkflow = new Subworkflow(
      'my_retry_predicate',
      [namedStep('always_retry', new ReturnStep(true))],
      [{ name: 'e' }],
    )

    const potentiallyFailingStep = namedStep(
      'http_step',
      new CallStep(
        'http.get',
        {
          url: 'https://maybe.failing.test/',
        },
        'response',
      ),
    )
    const knownErrors = namedStep(
      'known_errors',
      new SwitchStep([
        new SwitchCondition($('e.code == 404'), {
          steps: [namedStep('return_error', new ReturnStep('Not found'))],
        }),
      ]),
    )
    const unknownErrors = namedStep('unknown_errors', new RaiseStep($('e')))
    const step = new TryExceptStep(
      [potentiallyFailingStep],
      [knownErrors, unknownErrors],
      {
        predicate: predicateSubworkflow.name,
        maxRetries: 3,
        backoff: {
          initialDelay: 2,
          maxDelay: 60,
          multiplier: 4,
        },
      },
      'e',
    )

    const expected = YAML.parse(`
    try:
        steps:
          - http_step:
                call: http.get
                args:
                    url: https://maybe.failing.test/
                result: response
    retry:
        predicate: \${my_retry_predicate}
        max_retries: 3
        backoff:
            initial_delay: 2
            max_delay: 60
            multiplier: 4
    except:
        as: e
        steps:
          - known_errors:
              switch:
                  - condition: \${e.code == 404}
                    steps:
                      - return_error:
                          return: "Not found"
          - unknown_errors:
              raise: \${e}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a for step', () => {
    const step = new ForStep(
      [namedStep('addStep', new AssignStep([['sum', $('sum + v')]]))],
      'v',
      [1, 2, 3],
    )

    const expected = YAML.parse(`
    for:
        value: v
        in: [1, 2, 3]
        steps:
          - addStep:
              assign:
                - sum: \${sum + v}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders an index-based for step', () => {
    const step = new ForStep(
      [namedStep('addStep', new AssignStep([['sum', $('sum + i*v')]]))],
      'v',
      [10, 20, 30],
      'i',
    )

    const expected = YAML.parse(`
    for:
        value: v
        index: i
        in: [10, 20, 30]
        steps:
          - addStep:
              assign:
                - sum: \${sum + i*v}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a for-range step', () => {
    const step = new ForStep(
      [namedStep('addStep', new AssignStep([['sum', $('sum + v')]]))],
      'v',
      undefined,
      undefined,
      1,
      9,
    )

    const expected = YAML.parse(`
    for:
        value: v
        range: [1, 9]
        steps:
          - addStep:
              assign:
                - sum: \${sum + v}
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders parallel branches', () => {
    const step = new ParallelStep({
      branch1: new StepsStep([
        namedStep(
          'say_hello_1',
          new CallStep('sys.log', {
            text: 'Hello from branch 1',
          }),
        ),
      ]),
      branch2: new StepsStep([
        namedStep(
          'say_hello_2',
          new CallStep('sys.log', {
            text: 'Hello from branch 2',
          }),
        ),
      ]),
    })

    const expected = YAML.parse(`
    parallel:
        branches:
          - branch1:
              steps:
                - say_hello_1:
                    call: sys.log
                    args:
                        text: Hello from branch 1
          - branch2:
              steps:
                - say_hello_2:
                    call: sys.log
                    args:
                        text: Hello from branch 2
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders parallel branches with shared variables and concurrency limit', () => {
    const step = new ParallelStep(
      {
        branch1: new StepsStep([
          namedStep(
            'assign_1',
            new AssignStep([['myVariable[0]', 'Set in branch 1']]),
          ),
        ]),
        branch2: new StepsStep([
          namedStep(
            'assign_2',
            new AssignStep([['myVariable[1]', 'Set in branch 2']]),
          ),
        ]),
      },
      ['myVariable'],
      2,
    )

    const expected = YAML.parse(`
    parallel:
        shared: [myVariable]
        concurrency_limit: 2
        branches:
          - branch1:
              steps:
                - assign_1:
                    assign:
                      - myVariable[0]: 'Set in branch 1'
          - branch2:
              steps:
                - assign_2:
                    assign:
                      - myVariable[1]: 'Set in branch 2'
    `)

    expect(step.render()).to.deep.equal(expected)
  })

  it('renders a parallel for step', () => {
    const step = new ParallelStep(
      new ForStep(
        [
          namedStep(
            'getBalance',
            new CallStep(
              'http.get',
              {
                url: $('"https://example.com/balance/" + userId'),
              },
              'balance',
            ),
          ),
          namedStep('add', new AssignStep([['total', $('total + balance')]])),
        ],
        'userId',
        ['11', '12', '13', '14'],
      ),
      ['total'],
    )

    const expected = YAML.parse(`
    parallel:
        shared: [total]
        for:
            value: userId
            in: ['11', '12', '13', '14']
            steps:
              - getBalance:
                  call: http.get
                  args:
                      url: \${"https://example.com/balance/" + userId}
                  result: balance
              - add:
                  assign:
                    - total: \${total + balance}
    `)

    expect(step.render()).to.deep.equal(expected)
  })
})
