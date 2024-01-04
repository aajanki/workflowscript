/* Functions for compiling WorkflowScript program to GCP Workflows YAML.
 *
 * This module can be called as script. An input filename can be given as
 * a command line parameter. If no parameter is given, the input is read
 * from stdin.
 *
 * Example:
 *
 * node compile.js inputFile
 */

import { IToken } from 'chevrotain'
import { workflowScriptLexer } from './parser/lexer.js'
import { WorfkflowScriptParser, createVisitor } from './parser/parser.js'
import { WorkflowApp, toYAMLString } from './ast/workflows.js'
import * as fs from 'node:fs'

export function compile(program: string): string {
  const tokens = tokenize(program)
  const ast = createAst(tokens)

  return toYAMLString(ast)
}

export function compileFile(path: fs.PathOrFileDescriptor): string {
  const code = fs.readFileSync(path, 'utf8')
  return compile(code)
}

function cliMain() {
  let inp: fs.PathOrFileDescriptor
  const args = process.argv.slice(2)
  if (args.length === 0) {
    inp = process.stdin.fd
  } else {
    inp = args[0]
  }

  console.log(compileFile(inp))
}

function tokenize(program: string): IToken[] {
  const lexResult = workflowScriptLexer.tokenize(program)

  if (lexResult.errors.length > 0) {
    throw new Error('Lex error: ' + JSON.stringify(lexResult.errors))
  }

  return lexResult.tokens
}

function createAst(tokens: IToken[]): WorkflowApp {
  const parser = new WorfkflowScriptParser()
  const visitor = createVisitor(parser)

  parser.input = tokens
  const cst = parser.program()
  const ast = visitor.visit(cst) as WorkflowApp

  // TODO: better error messages
  if (parser.errors.length > 0) {
    throw new Error('Parsing error: ' + JSON.stringify(parser.errors))
  }

  return ast
}

if (import.meta.url.endsWith(process.argv[1])) {
  cliMain()
}
