## Version 0.2.0

2024-04-07

Breaking changes:
- The syntax for logical operators is changed to `&&`, `||` and `!`

Features:
- Labeling steps manually: `// @step-name: my_step_name`
- No more nested call + assign steps in the output
- The numbering of assign steps is more stable and does not change anymore if
  a new assignment statement is added in an existing step
