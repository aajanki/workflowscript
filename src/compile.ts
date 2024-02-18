#!/usr/bin/env node

/* Functions for compiling WorkflowScript program to GCP Workflows YAML.
 *
 * This module can be called as script. An input filename can be given as
 * a command line parameter. If no parameter is given, the input is read
 * from stdin.
 *
 * To compile a file called source.wfs:
 *
 * node dist/compile.js source.wfs
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
import { Option, program } from 'commander'
import * as fs from 'node:fs'
import { workflowScriptLexer } from './parser/lexer.js'
import { WorfkflowScriptParser } from './parser/parser.js'
import { createVisitor } from './parser/cstvisitor.js'
import { WorkflowApp, toYAMLString } from './ast/workflows.js'
import {
  WorkflowValidationError,
  validate,
  validatorNames,
} from './ast/validation.js'
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

function collect<T>(value: T, previous: T[]): T[] {
  return previous.concat([value])
}

function parseArgs() {
  program
    .name('wfscompile')
    .version('0.1.1')
    .description(
      'Compiles WorkflowScript source code into GCP Workflows a YAML program.',
    )
    .addOption(
      new Option(
        '--disableValidators <VALIDATOR>',
        'disable a named source code validator. Can be given multiple times.',
      )
        .choices(validatorNames())
        .default([])
        .argParser(collect<string>),
    )
    .argument(
      '[FILES]',
      'Path to source file(s) to compile. If not given, reads from stdin.',
    )
  program.parse()
  const opts = program.opts()
  return {
    sourceFiles: program.args,
    disabledValidators: opts.disableValidators as string[],
  }
}

function cliMain() {
  const args = parseArgs()

  let files = []
  if (args.sourceFiles.length === 0) {
    files = ['-']
  } else {
    files = args.sourceFiles
  }

  files.forEach((inputFile) => {
    const inp = inputFile === '-' ? process.stdin.fd : inputFile
    let sourceCode = ''

    try {
      sourceCode = fs.readFileSync(inp, 'utf8')
      console.log(compile(sourceCode, args.disabledValidators))
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
        prettyPrintSyntaxError(err, inputFile, sourceCode)
        process.exit(1)
      } else if (err instanceof PostParsingError) {
        prettyPrintPostParsingError(err, inputFile, sourceCode)
        process.exit(1)
      } else if (isLexingError(err)) {
        prettyPrintLexingError(err, inputFile, sourceCode)
        process.exit(1)
      } else if (err instanceof WorkflowValidationError) {
        prettyPrintValidationError(err, inputFile)
        process.exit(1)
      } else if (err instanceof InternalParsingError) {
        prettyPrintInternalError(err, inputFile)
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
  sourceCode: string,
): void {
  console.error(errorDisplay(inputFile, sourceCode, exception.token))
  console.error(`${exception.message}`)
}

function prettyPrintPostParsingError(
  exception: PostParsingError,
  inputFile: string,
  sourceCode: string,
): void {
  console.error(errorDisplay(inputFile, sourceCode, exception.location))
  console.error(`${exception.message}`)
}

function prettyPrintLexingError(
  exception: ILexingError,
  inputFile: string,
  sourceCode: string,
): void {
  const errorLocation = {
    startOffset: exception.offset,
    endOffset: exception.offset + exception.length - 1,
    startLine: exception.line,
    startColumn: exception.column,
  }

  console.error(errorDisplay(inputFile, sourceCode, errorLocation))
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

function prettyPrintInternalError(
  exception: InternalParsingError,
  inputFile: string,
): void {
  const prettyFileName = inputFile === '-' ? '<stdin>' : inputFile
  console.error(exception.message)
  console.error(`while compiling ${prettyFileName}`)
  console.error('Parsing context:')
  console.error(JSON.stringify(exception.context))
}

function errorDisplay(
  filename: string,
  sourceCode: string,
  location:
    | {
        startOffset: number
        endOffset?: number
        startLine?: number
        startColumn?: number
      }
    | undefined,
): string {
  const lines: string[] = []
  const prettyFilename = filename === '-' ? '<stdin>' : filename
  if (
    typeof location?.startLine === 'undefined' ||
    typeof location?.startColumn === 'undefined' ||
    isNaN(location?.startLine) ||
    isNaN(location.startColumn)
  ) {
    lines.push(`File ${prettyFilename}:`)
  } else {
    lines.push(
      `File ${prettyFilename}, line ${location.startLine}, column ${location.startColumn}:`,
    )
  }

  if (typeof location?.endOffset !== 'undefined') {
    const highlightedLine = highlightedSourceCodeLine(
      sourceCode,
      location.startOffset,
      location.endOffset,
    )
    if (highlightedLine.length > 0) {
      lines.push(highlightedLine)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function highlightedSourceCodeLine(
  sourceCode: string,
  startOffset: number,
  endOffset: number,
): string {
  if (
    isNaN(startOffset) ||
    isNaN(endOffset) ||
    startOffset >= sourceCode.length
  ) {
    return ''
  }

  let lineStart = startOffset
  while (lineStart > 0 && sourceCode[lineStart] != '\n') {
    lineStart--
  }
  if (lineStart < startOffset) {
    lineStart++
  }

  let lineEnd = startOffset
  while (lineEnd < sourceCode.length && sourceCode[lineEnd] != '\n') {
    lineEnd++
  }

  const markerStart = startOffset - lineStart
  const markerLength = Math.min(
    endOffset - startOffset + 1,
    lineEnd - startOffset,
  )
  const markerLine = `${' '.repeat(markerStart)}${'^'.repeat(markerLength)}`

  return `${sourceCode.substring(lineStart, lineEnd)}\n${markerLine}`
}

if (
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1].endsWith('/wfscompile')
) {
  cliMain()
}
