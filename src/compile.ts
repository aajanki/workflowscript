#!/usr/bin/env node

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
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(compileFile(process.stdin.fd))
  } else {
    args.forEach((inputFile) => {
      const inp = inputFile === '-' ? process.stdin.fd : inputFile

      try {
        console.log(compileFile(inp))
      } catch (err) {
        if (isIoError(err, 'ENOENT')) {
          console.error(`Error: "${inp}" not found`)
          process.exit(1)
        } else if (isIoError(err, 'EISDIR')) {
          console.error(`Error: "${inp}" is a directory`)
          process.exit(1)
        } else if (isIoError(err, 'EAGAIN') && inp === process.stdin.fd) {
          // Reading from stdin if there's no input causes error. This is a bug in node
          console.error('Error: Failed to read from stdin')
          process.exit(1)
        } else {
          throw err
        }
      }
    })
  }
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

function isIoError(err: unknown, errorCode: string): boolean {
  return err instanceof Error && 'code' in err && err.code == errorCode
}

if (
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1].endsWith('/wfscompile')
) {
  cliMain()
}
