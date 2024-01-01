# The WorkflowScript syntax

## Data types

- Integer (64 bit, signed)
- Double (64 bit, signed floating point number)
- String: `"my beautiful string"` (only double quotes are accepted, not single quotes)
- Boolean (true/false, True/False, TRUE/FALSE)
- null
- Array: `[1, 2, 3]`
- Map: `{temperature: -12, unit: "Celsius"}`

## Expressions

All expressions must begin with a `$` and be enclosed in curly brackets. The plan is to write a proper expression parser in the future and to get rid of the `${}`.

Examples:

```
${a + b}

${args.user.id}

${name === "Bean"}

${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}

${default(map.get(myMap, "id"), "(missing)")}
```

See [expression in GCP Workflows](https://cloud.google.com/workflows/docs/reference/syntax/expressions).

## Subworkflow definitions

The program code must be written inside workflow blocks. The workflow execution starts from the workflow called "main".

```
workflow main() {
  a = 1
}

workflow anotherWorkflow {
  b = 10
  return ${2 * b}
}
```

Workflows can have parameters:

```
workflow multiply(firstFactor, secondFactor) {
  return ${firstFactor * secondFactor}
}
```

Optional parameters are not yet supported.

### Returning value from a subworkflow

```javascript
return 'Success'
```

The returned value can be an expression:

```javascript
return ${firstFactor * secondFactor}
```

At the moment, return must always have a value. A plain `return` is not supported.

## Assignments

The WorkflowScript statement

```javascript
name = 'Bean'
```

will be compiled to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - name: Bean
```

## Function and subworkflow calls

The WorkflowScript statement

```javascript
response = http.get((url = 'https://www.example.com/path'))
```

will be compiled to a [call step](https://cloud.google.com/workflows/docs/reference/syntax/calls):

```yaml
- call1:
    call: http.get
    args:
      url: https://www.example.com/path
    result: response
```

This syntax can be used to call a [standard library function](https://cloud.google.com/workflows/docs/reference/stdlib/overview) or a subworkflow. The parameter names are required (and their order isn't significant).

## Conditional statements

The WorkflowScript statement

```javascript
if (${hour < 12}) {
  part_of_the_day = "morning"
} else if (${hour < 17}) {
  part_of_the_day = "afternoon"
} else if (${hour < 21}) {
  part_of_the_day = "evening"
} else {
  part_of_the_day = "night"
}
```

will be compiled to a [switch step](https://cloud.google.com/workflows/docs/reference/syntax/conditions)

```yaml
- switch1:
    switch:
      - condition: ${hour < 12}
        steps:
          - assign1:
              assign:
                - part_of_the_day: morning
      - condition: ${hour < 17}
        steps:
          - assign2:
              assign:
                - part_of_the_day: afternoon
      - condition: ${hour < 21}
        steps:
          - assign3:
              assign:
                - part_of_the_day: evening
      - condition: true
        steps:
          - assign4:
              assign:
                - part_of_the_day: night
```

## Parallel branches

The WorkflowScript statement

```
parallel branch {
  http.post(url = "https://forum.dreamland.test/register/bean")
}
branch {
  http.post(url = "https://forum.dreamland.test/register/elfo")
}
branch {
  http.post(url = "https://forum.dreamland.test/register/luci")
}
```

will be compiled to [parallel steps](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps)

```
parallel1:
    parallel:
        branches:
            - branch1:
                steps:
                    - call1:
                        call: http.post
                        args:
                            url: https://forum.dreamland.test/register/bean
            - branch2:
                steps:
                    - call2:
                        call: http.post
                        args:
                            url: https://forum.dreamland.test/register/elfo
            - branch3:
                steps:
                    - call3:
                        call: http.post
                        args:
                            url: https://forum.dreamland.test/register/luci
```

The shared variables and concurrency limits can be set with the following syntax:

```
parallel (
  shared = ["numPosts"],
  concurrency_limit = 2
)
branch {
  n = http.get(url = "https://forum.dreamland.test/numPosts/bean")
  numPosts = ${numPosts + n}
}
branch {
  n = http.get(url = "https://forum.dreamland.test/numPosts/elfo")
  numPosts = ${numPosts + n}
}
```

## Parallel for

TBD

## For loops

TBD

## Try/catch

TBD

## Raise

TBD
