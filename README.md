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

```shell
npm install
npm run build
node dist/compile.js examples/hello.wfs
```

The source can also be piped to the compile.js:

```shell
cat examples/hello.wfs | node dist/compile.js
```

The compile command will output the workflows YAML on stdout.

See [WorkflowScript language syntax](syntax.md) for a more detailed specification.

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

- for loops
- paraller for
- `break`
- `continue`
- A proper parsing of expressions. Get rid of `${...}`
- Better error messages
- Adapt all the validators from gcp-workflows-tookit

Quality-of-life improvements to be implemented later:

- `return` without a value
- `return subworkflow()`
- finally block in try?

## License

[The MIT License](LICENSE)
