# WorkflowScript - a JavaScript inspired programming language for writing GCP Workflows programs

This project is a compiler for WorkflowScript. WorkflowScript is a programming
language for writing [GCP Workflows](https://cloud.google.com/workflows/docs/apis)
programs in a Javascript-like language that is then compile into the native GCP
Workflows YAML syntax.

A sample program in WorkflowScript:

```javascript
workflow main() {
  name = "workflows"

  sys.log(text="Hello, " + name)
}
```

The [examples](examples) directory contains more sample programs.

Compiling a samples program in `examples/hello.wfs`:

```shell
npm install
npm run build
node dist/compile.js examples/hello.wfs
```

The source can also be piped to the compile.js:

```shell
cat examples/hello.wfs | node dist/compile.js
```

Alternatively, the compiler can be called as `wfscompile` npm script:

```shell
npx wfscompile examples/hello.wfs
```

The compile command will output the workflows YAML on stdout.

See [WorkflowScript language syntax](syntax.md) for a more detailed specification.

## Compiler API

Calling the Workflow compiler from a Javascript application:

```javascript
import { compile } from 'dist/index.js'

compile(fs.readFileSync('example/hello.wfs', 'utf8'))
```

Compiling when a source code file:

```javascript
import { compileFile } from 'dist/index.js'

compileFile('example/hello.wfs')
```

## Validation

The compiler checks the workflow for common errors. If it detects an error, it throws a WorkflowValidationError.

Currently implemented validators:

- `"duplicatedStepName"` checks that there are no duplicated step names in the workflow
- `"duplicatedSubworkflowName"` checks that there are not duplicated subworkflow names
- `"invalidWorkflowName"` checks that the workflow names are valid
- `"missingJumpTarget"` checks that call and next steps targets exist
- `"wrongNumberOfCallArguments"` checks that a correct number of arguments is provided in subworkflow calls

It is possible to disable some validators by listing the names of validators-to-be-disabled as the second argument of the `compile()` or `compileFile()` function invocation. This might be handy, for example, if a validator is buggy and rejects a valid workflow. It is not possible to disable validators when calling as a script currently.

```javascript
import { compile } from 'dist/index.js'

const workflowSource = 'workflow main() {}'
const disabled = ['missingJumpTarget']

compile(workflowSource, disabled)
```

## Build

```shell
npm install
npm run build
```

## Tests

```shell
npm run test
```

## TODO

This is alpha quality software! Not all workflow features are supported yet.

At least the following features should be implemented before this can be considered usable:

- parallel for
- A proper parsing of expressions. Get rid of `${...}`
- dynamic keys in maps: `{"${dynamicKey}": "myValue"}`
- Better error messages

Quality-of-life improvements to be implemented later:

- `return` without a value
- finally block in try?
- index variable in a for loop
- named arguments and assignment not currently not compatible: `response = http.get(url = "http://example.com")`

## License

[The MIT License](LICENSE)
