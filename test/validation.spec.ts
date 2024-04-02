import { expect } from 'chai'
import { Subworkflow, WorkflowApp } from '../src/ast/workflows.js'
import { WorkflowValidationError, validate } from '../src/ast/validation.js'
import { namedStep, parseExpression, primitiveEx } from './testutils.js'
import {
  AssignStepAST,
  CallStepAST,
  ReturnStepAST,
  StepsStepASTNamed,
  SwitchConditionASTNamed,
  SwitchStepASTNamed,
} from '../src/ast/steps.js'

describe('Validator', () => {
  it('accepts a valid workflow', () => {
    const steps = [
      namedStep(
        'assign_name',
        new AssignStepAST([['name', primitiveEx('Fry')]]),
      ),
      namedStep(
        'say_hello',
        new CallStepAST('sys.log', {
          text: parseExpression('"Hello, " + name'),
        }),
      ),
    ]
    const wf = new WorkflowApp([new Subworkflow('main', steps)])

    expect(() => validate(wf)).to.not.throw()
  })

  it('detects duplicate step names in the main workflow', () => {
    const steps = [
      namedStep(
        'duplicated_name',
        new AssignStepAST([['name', primitiveEx('Fry')]]),
      ),
      namedStep(
        'duplicated_name',
        new CallStepAST('sys.log', {
          text: parseExpression('"Hello, " + name'),
        }),
      ),
    ]
    const wf = new WorkflowApp([new Subworkflow('main', steps)])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('duplicatedStepName')
  })

  it('can disable selected validators', () => {
    const steps = [
      namedStep(
        'duplicated_name',
        new AssignStepAST([['name', primitiveEx('Fry')]]),
      ),
      namedStep(
        'duplicated_name',
        new CallStepAST('sys.log', {
          text: parseExpression('"Hello, " + name'),
        }),
      ),
    ]
    const wf = new WorkflowApp([new Subworkflow('main', steps)])
    const disabled = ['duplicatedStepName']

    expect(() => validate(wf, disabled)).to.not.throw(WorkflowValidationError)
  })

  it('detects duplicate step names in a subworkflow workflow', () => {
    const subworkflow = new Subworkflow(
      'say_hello',
      [
        namedStep(
          'duplicated_name',
          new CallStepAST('sys.log', {
            text: parseExpression('"Hello, " + name'),
          }),
        ),
        namedStep('duplicated_name', new ReturnStepAST(primitiveEx(1))),
      ],
      [{ name: 'name' }],
    )
    const mainWorkflow = new Subworkflow('main', [
      namedStep(
        'call_subworkflow',
        new CallStepAST(subworkflow.name, {
          name: primitiveEx('Leela'),
        }),
      ),
    ])
    const wf = new WorkflowApp([mainWorkflow, subworkflow])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('duplicatedStepName')
  })

  it('detects duplicate step names in nested steps', () => {
    const steps = [
      namedStep(
        'print_quotes',
        new StepsStepASTNamed([
          namedStep(
            'duplicated_name',
            new AssignStepAST([['name', primitiveEx('Fry')]]),
          ),
          namedStep(
            'switch_step',
            new SwitchStepASTNamed([
              new SwitchConditionASTNamed(parseExpression('name == "Fry"'), [
                namedStep(
                  'fry_quote',
                  new AssignStepAST([
                    ['quote', primitiveEx('Space. It seems to go on forever.')],
                  ]),
                ),
              ]),
              new SwitchConditionASTNamed(
                parseExpression('name == "Zoidberg"'),
                [
                  namedStep(
                    'duplicated_name',
                    new AssignStepAST([
                      [
                        'quote',
                        primitiveEx(
                          "Casual hello. It's me, Zoidberg. Act naturally.",
                        ),
                      ],
                    ]),
                  ),
                ],
              ),
              new SwitchConditionASTNamed(parseExpression('name == "Leela"'), [
                namedStep(
                  'leela_quote',
                  new AssignStepAST([
                    [
                      'quote',
                      primitiveEx(
                        "Look, I don't know about your previous captains, but I intend to do as little dying as possible.",
                      ),
                    ],
                  ]),
                ),
              ]),
            ]),
          ),
          namedStep(
            'step2',
            new CallStepAST('sys.log', {
              text: parseExpression('name + ": " + quote'),
            }),
          ),
        ]),
      ),
    ]
    const wf = new WorkflowApp([new Subworkflow('main', steps)])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('duplicatedStepName')
  })

  it('accepts the same steps name being used in the main and a subworkflow', () => {
    const subworkflow = new Subworkflow(
      'say_hello',
      [
        namedStep(
          'step1',
          new CallStepAST('sys.log', {
            text: parseExpression('"Hello, " + name'),
          }),
        ),
        namedStep('step2', new ReturnStepAST(primitiveEx(1))),
      ],
      [{ name: 'name' }],
    )
    const mainWorkflow = new Subworkflow('main', [
      namedStep(
        'step1',
        new CallStepAST(subworkflow.name, {
          name: primitiveEx('Leela'),
        }),
      ),
    ])
    const wf = new WorkflowApp([mainWorkflow, subworkflow])

    expect(() => validate(wf)).not.to.throw()
  })

  it("doesn't allow duplicate subworkflow names", () => {
    const main = new Subworkflow('main', [
      namedStep('step1', new AssignStepAST([['a', primitiveEx('a')]])),
    ])
    const sub1 = new Subworkflow('mysubworkflow', [
      namedStep('return1', new ReturnStepAST(primitiveEx(1))),
    ])
    const sub2 = new Subworkflow('anotherworkflow', [
      namedStep('return2', new ReturnStepAST(primitiveEx(2))),
    ])
    const sub3 = new Subworkflow('mysubworkflow', [
      namedStep('return3', new ReturnStepAST(primitiveEx(3))),
    ])
    const wf = new WorkflowApp([main, sub1, sub2, sub3])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('duplicatedSubworkflowName')
  })

  it('detects a missing next target', () => {
    const sub1 = new Subworkflow('subworkflow1', [
      namedStep('return1', new ReturnStepAST(primitiveEx(1))),
    ])
    const sub2 = new Subworkflow('subworkflow2', [
      namedStep('return2', new ReturnStepAST(primitiveEx(2))),
    ])
    const step3 = namedStep(
      'step3',
      new CallStepAST('sys.log', {
        text: primitiveEx('Logging from step 3'),
      }),
    )
    const switch1 = namedStep(
      'step1',
      new SwitchStepASTNamed(
        [
          new SwitchConditionASTNamed(
            parseExpression('input == 1'),
            [],
            'step3',
          ),
        ],
        'missing_step',
      ),
    )
    const main = new Subworkflow('main', [switch1, step3], [{ name: 'input' }])
    const wf = new WorkflowApp([main, sub1, sub2])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('missingJumpTarget')
  })

  it('detects a missing call target subworkflow', () => {
    const sub1 = new Subworkflow('subworkflow1', [
      namedStep('return1', new ReturnStepAST(primitiveEx(1))),
    ])
    const sub2 = new Subworkflow('subworkflow2', [
      namedStep('return2', new ReturnStepAST(primitiveEx(2))),
    ])
    const call1 = namedStep('call1', new CallStepAST(sub1.name))
    const main = new Subworkflow('main', [call1], [{ name: 'input' }])
    const wf = new WorkflowApp([main, sub2])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('missingJumpTarget')
  })

  it('detects if a required subworkflow argument is not provided', () => {
    const subworkflow = new Subworkflow(
      'subworkflow1',
      [
        namedStep(
          'return1',
          new ReturnStepAST(parseExpression('required_arg_1 + required_arg_2')),
        ),
      ],
      [{ name: 'required_arg_1' }, { name: 'required_arg_2' }],
    )

    const main = new Subworkflow('main', [
      namedStep(
        'call1',
        new CallStepAST(subworkflow.name, {
          required_arg_1: primitiveEx(1),
        }),
      ),
    ])
    const wf = new WorkflowApp([main, subworkflow])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('wrongNumberOfCallArguments')
  })

  it('optional subworkflow parameters may be missing', () => {
    const subworkflow = new Subworkflow(
      'subworkflow1',
      [
        namedStep(
          'return1',
          new ReturnStepAST(parseExpression('required_arg_1 + optional_arg_2')),
        ),
      ],
      [{ name: 'required_arg_1' }, { name: 'optional_arg_2', default: 2 }],
    )

    const main = new Subworkflow('main', [
      namedStep(
        'call1',
        new CallStepAST(subworkflow.name, {
          required_arg_1: primitiveEx(1),
        }),
      ),
    ])
    const wf = new WorkflowApp([main, subworkflow])

    expect(() => validate(wf)).not.to.throw(WorkflowValidationError)
  })

  it('detects if a call step has too many arguments', () => {
    const subworkflow = new Subworkflow(
      'subworkflow1',
      [
        namedStep(
          'return1',
          new ReturnStepAST(parseExpression('required_arg_1 + required_arg_2')),
        ),
      ],
      [{ name: 'required_arg_1' }, { name: 'required_arg_2' }],
    )

    const main = new Subworkflow('main', [
      namedStep(
        'step1',
        new CallStepAST(subworkflow.name, {
          required_arg_1: primitiveEx(1),
          required_arg_2: primitiveEx(2),
          extra_argument: primitiveEx('X'),
        }),
      ),
    ])
    const wf = new WorkflowApp([main, subworkflow])

    expect(() => validate(wf)).to.throw(WorkflowValidationError)
    expect(() => validate(wf)).to.throw('wrongNumberOfCallArguments')
  })

  it('accepts a value for optional subworkflow parameters', () => {
    const subworkflow = new Subworkflow(
      'subworkflow1',
      [
        namedStep(
          'return1',
          new ReturnStepAST(parseExpression('required_arg_1 + optional_arg_2')),
        ),
      ],
      [{ name: 'required_arg_1' }, { name: 'optional_arg_2', default: 2 }],
    )

    const main = new Subworkflow('main', [
      namedStep(
        'step1',
        new CallStepAST(subworkflow.name, {
          required_arg_1: primitiveEx(1),
          optional_arg_2: primitiveEx(2),
        }),
      ),
    ])
    const wf = new WorkflowApp([main, subworkflow])

    expect(() => validate(wf)).not.to.throw(WorkflowValidationError)
  })
})
