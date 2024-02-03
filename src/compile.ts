#!/usr/bin/env node

/* Functions for compiling WorkflowScript program to GCP Workflows YAML.
 *
 * This module can be called as script. An input filename can be given as
 * a command line parameter. If no parameter is given, the input is read
 * from stdin.
 *
 * Example:
 *
 * node dist/compile.js inputFile
 */

import {
  EarlyExitException,
  ILexingError,
  IRecognitionException,
  IToken,
  MismatchedTokenException,
  NoViableAltException,
  NotAllInputParsedException,
} from 'chevrotain'
import { workflowScriptLexer } from './parser/lexer.js'
import { WorfkflowScriptParser } from './parser/parser.js'
import { createVisitor } from './parser/cstvisitor.js'
import { WorkflowApp, toYAMLString } from './ast/workflows.js'
import * as fs from 'node:fs'
import { WorkflowValidationError, validate } from './ast/validation.js'
import { isRecord } from './utils.js'
import { InternalParsingError, PostParsingError } from './parser/errors.js'

export function compile(
  program: string,
  disabledValidators: string[] = [],
): string {
  const tokens = tokenize(program)
  const workflowApp = createAst(tokens)
  validate(workflowApp, disabledValidators)

  return toYAMLString(workflowApp)
}

export function compileFile(
  path: fs.PathOrFileDescriptor,
  disabledValidators: string[] = [],
): string {
  const code = fs.readFileSync(path, 'utf8')
  return compile(code, disabledValidators)
}

function cliMain() {
  const args = process.argv.slice(2)

  let files = []
  if (args.length === 0) {
    files = ['-']
  } else {
    files = args
  }

  files.forEach((inputFile) => {
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
      } else if (
        err instanceof MismatchedTokenException ||
        err instanceof NoViableAltException ||
        err instanceof NotAllInputParsedException ||
        err instanceof EarlyExitException
      ) {
        prettyPrintSyntaxError(err, inputFile)
        process.exit(1)
      } else if (err instanceof PostParsingError) {
        prettyPrintPostParsingError(err, inputFile)
        process.exit(1)
      } else if (isLexingError(err)) {
        prettyPrintLexingError(err, inputFile)
        process.exit(1)
      } else if (err instanceof WorkflowValidationError) {
        prettyPrintValidationError(err, inputFile)
        process.exit(1)
      } else if (err instanceof InternalParsingError) {
        console.log(err.message)
        process.exit(1)
      } else {
        throw err
      }
    }
  })
}

function tokenize(program: string): IToken[] {
  const lexResult = workflowScriptLexer.tokenize(program)

  if (lexResult.errors.length > 0) {
    throw lexResult.errors[0]
  }

  return lexResult.tokens
}

function createAst(tokens: IToken[]): WorkflowApp {
  const parser = new WorfkflowScriptParser()
  const visitor = createVisitor(parser)

  parser.input = tokens
  const cst = parser.program()
  const ast = visitor.visit(cst) as WorkflowApp

  if (parser.errors.length > 0) {
    throw parser.errors[0]
  }

  return ast
}

function isIoError(err: unknown, errorCode: string): boolean {
  return err instanceof Error && 'code' in err && err.code == errorCode
}

function isLexingError(err: unknown): err is ILexingError {
  return (
    isRecord(err) &&
    'offset' in err &&
    'line' in err &&
    'column' in err &&
    'length' in err &&
    'message' in err
  )
}

function prettyPrintSyntaxError(
  exception: IRecognitionException,
  inputFile: string,
): void {
  const prettyFileName = inputFile === '-' ? '<stdin>' : inputFile
  if (
    typeof exception.token?.startLine === 'undefined' ||
    typeof exception.token?.startColumn === 'undefined'
  ) {
    console.log(`File ${prettyFileName}:`)
  } else {
    console.error(
      `File ${prettyFileName}, line ${exception.token.startLine}, column ${exception.token.startColumn}:`,
    )
  }
  console.error(`${exception.message}`)
}

function prettyPrintPostParsingError(
  exception: PostParsingError,
  inputFile: string,
): void {
  const prettyFileName = inputFile === '-' ? '<stdin>' : inputFile
  if (
    typeof exception.location?.startLine === 'undefined' ||
    typeof exception.location?.startColumn === 'undefined'
  ) {
    console.log(`File ${prettyFileName}:`)
  } else {
    console.error(
      `File ${prettyFileName}, line ${exception.location.startLine}, column ${exception.location.startColumn}:`,
    )
  }
  console.error(`${exception.message}`)
}

function prettyPrintLexingError(
  exception: ILexingError,
  inputFile: string,
): void {
  const prettyFileName = inputFile === '-' ? '<stdin>' : inputFile
  if (
    typeof exception.line === 'undefined' ||
    typeof exception.column === 'undefined'
  ) {
    console.error(`File ${prettyFileName}:`)
  } else {
    console.error(
      `File ${prettyFileName}, line ${exception.line}, column ${exception.column}:`,
    )
  }
  console.error(exception.message)
}

function prettyPrintValidationError(
  exception: WorkflowValidationError,
  inputFile: string,
): void {
  const prettyFileName = inputFile === '-' ? '<stdin>' : inputFile
  console.error(`Validation errors in file ${prettyFileName}:`)
  exception.issues.forEach((x) => {
    console.error(`- ${x.message} (${x.type})`)
  })
}

if (
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1].endsWith('/wfscompile')
) {
  cliMain()
}
