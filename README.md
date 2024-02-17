# WorkflowScript - a JavaScript-inspired programming language for writing GCP Workflows programs

This is a compiler for WorkflowScript. WorkflowScript is a programming
language for writing [GCP Workflows](https://cloud.google.com/workflows/docs/apis)
programs in a Javascript-like syntax. The compiler compiles WorkflowScript
source code into GCP Workflows YAML syntax.

## WorkflowScript syntax and sample programs

A sample program in WorkflowScript:

```javascript
workflow main() {
  name = "workflows"

  sys.log(text="Hello, " + name)
}
```

The [examples](examples) directory contains more sample programs.

[WorkflowScript language reference](syntax.md) documents the valid WorkflowScript syntax.

## Installation

```shell
npm install workflowscript
```

## Using the compiler

Compiling a sample program in the file `examples/hello.wfs`:

```shell
npx wfscompile examples/hello.wfs
```

The source can also be piped to the compiler:

```shell
cat examples/hello.wfs | npx wfscompile
```

The compiler will output the workflows YAML on stdout.

## Command line options

The `wfscompile` command can take the following optional arguments:

- `--disableValidators <VALIDATOR>`: disable a named source code validator. See below for validator names. Can be given multiple times.

Run `npx wfscompile -h` to see all options.

## Error handling

If the compiler encounters parsing errors or detects invalid syntax, it prints an error message and quits with a non-zero exit code.

Some error checks can be disabled with the `--disableValidators` command line option. This might be handy, for example, if a error check is buggy and rejects a valid program. The names and functionality of checks that can be disabled:

- `duplicatedStepName` checks that there are no duplicated step names in the workflow
- `duplicatedSubworkflowName` checks that there are not duplicated subworkflow names
- `invalidWorkflowName` checks that the workflow names are valid
- `missingJumpTarget` checks that call and next steps targets exist
- `wrongNumberOfCallArguments` checks that a correct number of arguments is provided in subworkflow calls

## Build

```shell
npm install
npm run build
```

## Test

```shell
npm run test
```

## Compiler API

Calling the Workflow compiler from a Javascript application:

```javascript
import { compile } from 'workflowscript'

const sourcecode = `workflow main() {
  sys.log(text="Hello workflows!")
}`

console.log(compile(sourcecode))
```

Compiling a source code file:

```javascript
import { compileFile } from 'workflowscript'

console.log(compileFile('examples/hello.wfs'))
```

It is possible to disable some validators by listing the names of validators-to-be-disabled as the second argument of the `compile()` or `compileFile()` function invocation.

```javascript
import { compile } from 'workflowscript'

const workflowSource = 'workflow main() {}'
const disabled = ['missingJumpTarget']

compile(workflowSource, disabled)
```

## Syntax diagram

Draw WorkflowScript grammar's syntax diagrams to grammar.html:

```shell
npm run diagram
```

## Roadmap

(not prioritized)

- Fix bugs. This is beta quality software! Expect at least some bugs.
- while loop
- Javascriptlike non-quoted object keys: `{firstKey: 1, second: 2}`
- finally block in try?
- index variable in a for loop
- floor division: `x // 2`. Comments?
- Detect uninitialized variables
- Dead code elimination (or at least dead subworkflow elimination)

## License

[The MIT License](LICENSE)
