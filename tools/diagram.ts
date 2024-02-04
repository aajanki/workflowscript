import { createSyntaxDiagramsCode } from 'chevrotain'
import { WorfkflowScriptParser } from '../src/parser/parser'

function main() {
  const parserInstance = new WorfkflowScriptParser()
  const productions = parserInstance.getSerializedGastProductions()
  console.log(createSyntaxDiagramsCode(productions))
}

if (import.meta.url.endsWith(process.argv[1])) {
  main()
}
