import { generateCstDts } from 'chevrotain'
import { WorfkflowScriptParser } from '../src/parser/parser'

function main() {
  const parserInstance = new WorfkflowScriptParser()
  const productions = parserInstance.getGAstProductions()
  console.log(
    generateCstDts(productions, {
      visitorInterfaceName: 'IWorkflowScriptCstNodeVisitor',
    }),
  )
}

if (import.meta.url.endsWith(process.argv[1])) {
  main()
}
