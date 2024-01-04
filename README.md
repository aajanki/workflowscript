# WorkflowScript - a JavaScript inspired programming language for writing GCP Workflows programs

This project is a compiler for WorkflowScript. WorkflowScript is a programming
language for writing [GCP Workflows](https://cloud.google.com/workflows/docs/apis)
programs in a Javascript-like language that is then compile into the native GCP
Workflows YAML syntax.

A sample program in WorkflowScript:

```
workflow main() {
  name = "workflows"

  sys.log(text=${"Hello, " + name})
}
```

The [examples](examples) directory contains other sample programs.

Compiling a samples program in `examples/hello.wfs`:

```
npm install
npm run build
node dist/compile.js examples/hello.wfs
```

The compile command will output the workflows YAML in stdout.

See [WorkflowScript language syntax](syntax.md) for a more detailed specification.

## Build

```
npm install
npm run build
```

## Tests

```
npm run test
```

## TODO

This is alpha quality software! Not all workflow features are supported yet.

At least the following features should be implemented before this can be considered usable:

- try/retry
- for loops
- paraller for
- optional parameters in subworkflows
- A proper parsing of expressions. Get rid of `${...}`
- `break`
- `continue`
- Better error messages
- Bring in unit tests from gcp-workflows-tookit
- Adapt all the validators from gcp-workflows-tookit

Quality-of-life improvements to be implemented later:

- `return` without a value
- `return subworkflow()`
- finally block in try?
- source code comments

## License

[The MIT License](LICENSE)
