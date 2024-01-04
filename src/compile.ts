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

export function compileFile(filename: string): string {
  const code = fs.readFileSync(filename, 'utf8')
  return compile(code)
}

function cliMain() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.log('Usage: node compile.js [source_code_file]')
    process.exit(1)
  }

  const [inputFilename] = args

  console.log(compileFile(inputFilename))
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
