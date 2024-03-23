# The WorkflowScript syntax

## Data types

- Integer (64 bit, signed)
- Double (64 bit, signed floating point number)
- String: `"my beautiful string"` (only double quotes are accepted, not single quotes)
- Boolean: `true`/`false`, `True`/`False`, `TRUE`/`FALSE`
- `null`
- Array: `[1, 2, 3]`
- Map: `{"temperature": -12, "unit": "Celsius"}`. JSON-like syntax. The keys must be strings: `"unit"` instead of `unit`. No trailing commas allowed!

## Expressions

Examples:

```javascript
a + b

args.users[3].id

name == "Bean"

sys.get_env("GOOGLE_CLOUD_PROJECT_ID")

default(map.get(myMap, "id"), "(missing)")
```

Operators:

| Operator     | Description                                  |
|--------------|----------------------------------------------|
| +            | arithmetic addition and string concatenation |
| -            | arithmetic subtraction or unary negation     |
| *            | multiplication                               |
| /            | float division                               |
| %            | remainder division                           |
| ==           | equal to                                     |
| !=           | not equal to                                 |
| <, >, <=, >= | inequality comparisons                       |
| &&, ||, !    | logical operators                            |

The [precendence order of operators](https://cloud.google.com/workflows/docs/reference/syntax/datatypes#order-operations) is the same as in GCP Workflows.

See [expression in GCP Workflows](https://cloud.google.com/workflows/docs/reference/syntax/expressions) for more information.

## Subworkflow definitions

The program code must be written inside workflow blocks. The execution starts from the subworkflow called "main".

```javascript
workflow main() {
  a = 1
}

workflow anotherWorkflow() {
  b = 10
  return 2 * b
}
```

Workflows can have parameters:

```javascript
workflow multiply(firstFactor, secondFactor) {
  return firstFactor * secondFactor
}
```

Parameters can be optional and have a default value that is used if a value is not provided in a subworkflow call:

```javascript
workflow log(x, base=10) {
  return "Compute logarithm of x"
}
```

### Returning value from a subworkflow

```javascript
return "Success"
```

The returned value can be an expression:

```javascript
return firstFactor * secondFactor
```

At the moment, return must always have a value. A plain `return` is not supported.

## Assignments

The WorkflowScript statement

```javascript
name = "Bean"
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
projectId = sys.get_env("GOOGLE_CLOUD_PROJECT_ID")
```

will be compiled to an [assign step](https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step):

```yaml
- assign1:
    assign:
      - projectId: ${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
```

This syntax can be used to call [standard library functions](https://cloud.google.com/workflows/docs/reference/stdlib/overview) or subworkflows.

### Named function arguments

It's also possible to use named function arguments. The following WorkflowScript statement

```javascript
response = http.get(url="https://www.example.com/path", timeout=600)
```

will be compiled to a [call step](https://cloud.google.com/workflows/docs/reference/syntax/calls):

```yaml
- call1:
    call: http.get
    args:
      url: https://www.example.com/path
      timeout: 600
    result: response
```

The order of arguments is not significant.

Note that [blocking calls](https://cloud.google.com/workflows/docs/reference/syntax/expressions#blocking-calls) (`http.*`, `sys.log`, etc.) must be called from a call step, i.e. using the named function argument syntax.

## Conditional statements

The WorkflowScript statement

```javascript
if (hour < 12) {
  part_of_the_day = "morning"
} else if (hour < 17) {
  part_of_the_day = "afternoon"
} else if (hour < 21) {
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

```yaml
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
  n = http.get("https://forum.dreamland.test/numPosts/bean")
  numPosts = numPosts + n
}
branch {
  n = http.get("https://forum.dreamland.test/numPosts/elfo")
  numPosts = numPosts + n
}
```

## Try/catch statements

The WorkflowScript statement

```javascript
try {
  http.get(url = "https://visit.dreamland.test/")
} catch (err) {
  return "Error!"
}
```

will be compiled to the following [try/except structure](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors)

```yaml
try1:
  try:
    steps:
      - call1:
          call: http.get
          args:
            url: https://visit.dreamland.test/
  except:
    as: err
    steps:
      - return1:
          return: Error!
```

The error variable and other variables created inside the catch block are accessible only in that block's scope (similar to [the variable scoping in Workflows](https://cloud.google.com/workflows/docs/reference/syntax/catching-errors#variable-scope)).

Failing steps can be retried with a retry policy. See the [documentation for GCP retry step](https://cloud.google.com/workflows/docs/reference/syntax/retrying).

There are two default retry policies: `http.default_retry` and `http.default_retry_non_idempotent`. The syntax for default retry policy is the following:

```javascript
try {
  http.get(url = "https://visit.dreamland.test/")
}
retry (policy = http.default_retry)
```

A custom retry policy is defined by specifying all of the following parameters:
- `predicate`: Name of the rule to define which errors retried. "http.default_retry", "http.default_retry_non_idempotent" or a subworkflow name
- `max_retries`: Maximum number of times a step will be retried, not counting the initial step execution attempt.
- `initial_delay`: delay in seconds between the initial failure and the first retry.
- `max_delay`: maximum delay in seconds between retries.
- `multiplier`: multiplier applied to the previous delay to calculate the delay for the subsequent retry.

```javascript
try {
  http.get(url = "https://visit.dreamland.test/")
}
retry (predicate = http.default_retry_predicate, max_retries = 10, initial_delay = 2.5, max_delay = 60, multiplier = 1.5)
```

Retry and catch blocks can be combined like this:

```javascript
try {
  http.get(url = "https://visit.dreamland.test/")
}
retry (policy = http.default_retry)
catch (err) {
  return "Error!"
}
```

## Throwing errors

The WorkflowScript statement

```javascript
throw "Error!"
```

will be compiled to the following [raise block](https://cloud.google.com/workflows/docs/reference/syntax/raising-errors)

```yaml
raise1:
  raise: "Error!"
```

The error can be a string, a map or an expression that evaluates to string or map.

Thrown errors can be handled by a try statement.

## For loops

The WorkflowScript fragment

```javascript
total = 0
for (i in [1, 2, 3]) {
  total = total + i
}
```

will be compiled to the following [for loop statement](https://cloud.google.com/workflows/docs/reference/syntax/iteration)

```yaml
steps:
  - assign1:
      assign:
        - total: 0
  - for1:
      for:
        value: i
        in:
          - 1
          - 2
          - 3
        steps:
          - assign2:
              assign:
                - total: ${total + i}
```

### Break and continue in a for loop

Breaking out of loop:

```javascript
total = 0
for (i in [1, 2, 3, 4]) {
  if (total > 5) {
    break
  }

  total = total + i
}
```

Continuing from the next iteration of a loop:

```javascript
total = 0
for (i in [1, 2, 3, 4]) {
  if (i % 2 == 0) {
    continue
  }

  total = total + i
}
```

## Parallel for

The WorkflowScript statement

```javascript
parallel for (username in ["bean", "elfo", "luci"]) {
  http.post(url = "https://forum.dreamland.test/register/" + username)
}
```

will be compiled to [parallel iteration](https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps#parallel-iteration):

```yaml
- parallel1:
    parallel:
      for:
        value: username
        in:
          - bean
          - elfo
          - luci
        steps:
          - call1:
              call: http.post
              args:
                url: ${"https://forum.dreamland.test/register/" + username}
```

The shared variables and concurrency limits can be set with the following syntax:

```javascript
parallel (
  shared = ["total"],
  concurrency_limit = 2
)
for (i in [1, 2, 3, 4]) {
  total = total + i
}
```

## Source code comments

Comments start with `//`. The parser ignores the rest of the line starting from `//`. There is no support for multiline comments.

```javascript
var1 = 1 // This is a comment
```
