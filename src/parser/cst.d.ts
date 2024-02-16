import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface ObjectCstNode extends CstNode {
  name: "object";
  children: ObjectCstChildren;
}

export type ObjectCstChildren = {
  LeftCurlyBracket: IToken[];
  objectItem?: (ObjectItemCstNode)[];
  Comma?: IToken[];
  RightCurlyBracket: IToken[];
};

export interface ObjectItemCstNode extends CstNode {
  name: "objectItem";
  children: ObjectItemCstChildren;
}

export type ObjectItemCstChildren = {
  StringLiteral: IToken[];
  Colon: IToken[];
  expression: ExpressionCstNode[];
};

export interface ArrayCstNode extends CstNode {
  name: "array";
  children: ArrayCstChildren;
}

export type ArrayCstChildren = {
  LeftSquareBracket: IToken[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  RightSquareBracket: IToken[];
};

export interface TermCstNode extends CstNode {
  name: "term";
  children: TermCstChildren;
}

export type TermCstChildren = {
  UnaryOperator?: IToken[];
  StringLiteral?: IToken[];
  NumberLiteral?: IToken[];
  object?: ObjectCstNode[];
  array?: ArrayCstNode[];
  True?: IToken[];
  False?: IToken[];
  Null?: IToken[];
  callExpression?: CallExpressionCstNode[];
  variableReference?: VariableReferenceCstNode[];
  parenthesizedExpression?: ParenthesizedExpressionCstNode[];
};

export interface LiteralCstNode extends CstNode {
  name: "literal";
  children: LiteralCstChildren;
}

export type LiteralCstChildren = {
  UnaryOperator?: IToken[];
  StringLiteral?: IToken[];
  NumberLiteral?: IToken[];
  True?: IToken[];
  False?: IToken[];
  Null?: IToken[];
};

export interface ExpressionCstNode extends CstNode {
  name: "expression";
  children: ExpressionCstChildren;
}

export type ExpressionCstChildren = {
  term: (TermCstNode)[];
  BinaryOperator?: IToken[];
};

export interface ParenthesizedExpressionCstNode extends CstNode {
  name: "parenthesizedExpression";
  children: ParenthesizedExpressionCstChildren;
}

export type ParenthesizedExpressionCstChildren = {
  LeftParenthesis: IToken[];
  expression: ExpressionCstNode[];
  RightParenthesis: IToken[];
};

export interface SubscriptReferenceCstNode extends CstNode {
  name: "subscriptReference";
  children: SubscriptReferenceCstChildren;
}

export type SubscriptReferenceCstChildren = {
  Identifier: IToken[];
  LeftSquareBracket?: IToken[];
  expression?: ExpressionCstNode[];
  RightSquareBracket?: IToken[];
};

export interface VariableReferenceCstNode extends CstNode {
  name: "variableReference";
  children: VariableReferenceCstChildren;
}

export type VariableReferenceCstChildren = {
  subscriptReference: (SubscriptReferenceCstNode)[];
  Dot?: IToken[];
};

export interface AssignmentStatementCstNode extends CstNode {
  name: "assignmentStatement";
  children: AssignmentStatementCstChildren;
}

export type AssignmentStatementCstChildren = {
  variableReference: VariableReferenceCstNode[];
  Assignment: IToken[];
  expression: ExpressionCstNode[];
};

export interface QualifiedIdentifierCstNode extends CstNode {
  name: "qualifiedIdentifier";
  children: QualifiedIdentifierCstChildren;
}

export type QualifiedIdentifierCstChildren = {
  Identifier: (IToken)[];
  Dot?: IToken[];
};

export interface ActualAnonymousParameterListCstNode extends CstNode {
  name: "actualAnonymousParameterList";
  children: ActualAnonymousParameterListCstChildren;
}

export type ActualAnonymousParameterListCstChildren = {
  expression?: ExpressionCstNode[];
  Comma?: IToken[];
};

export interface ActualNamedParameterListCstNode extends CstNode {
  name: "actualNamedParameterList";
  children: ActualNamedParameterListCstChildren;
}

export type ActualNamedParameterListCstChildren = {
  Identifier?: IToken[];
  Assignment?: IToken[];
  expression?: ExpressionCstNode[];
  Comma?: IToken[];
};

export interface ActualParameterListCstNode extends CstNode {
  name: "actualParameterList";
  children: ActualParameterListCstChildren;
}

export type ActualParameterListCstChildren = {
  actualNamedParameterList?: ActualNamedParameterListCstNode[];
  actualAnonymousParameterList?: ActualAnonymousParameterListCstNode[];
};

export interface CallExpressionCstNode extends CstNode {
  name: "callExpression";
  children: CallExpressionCstChildren;
}

export type CallExpressionCstChildren = {
  qualifiedIdentifier: QualifiedIdentifierCstNode[];
  LeftParenthesis: IToken[];
  actualAnonymousParameterList: ActualAnonymousParameterListCstNode[];
  RightParenthesis: IToken[];
};

export interface CallStatementCstNode extends CstNode {
  name: "callStatement";
  children: CallStatementCstChildren;
}

export type CallStatementCstChildren = {
  Identifier?: IToken[];
  Assignment?: IToken[];
  qualifiedIdentifier: QualifiedIdentifierCstNode[];
  LeftParenthesis: IToken[];
  actualParameterList: ActualParameterListCstNode[];
  RightParenthesis: IToken[];
};

export interface IfStatementCstNode extends CstNode {
  name: "ifStatement";
  children: IfStatementCstChildren;
}

export type IfStatementCstChildren = {
  If: (IToken)[];
  LeftParenthesis: (IToken)[];
  expression: (ExpressionCstNode)[];
  RightParenthesis: (IToken)[];
  LeftCurlyBracket: (IToken)[];
  statementBlock: (StatementBlockCstNode)[];
  RightCurlyBracket: (IToken)[];
  Else?: (IToken)[];
};

export interface TryStatementCstNode extends CstNode {
  name: "tryStatement";
  children: TryStatementCstChildren;
}

export type TryStatementCstChildren = {
  Try: IToken[];
  LeftCurlyBracket: (IToken)[];
  statementBlock: (StatementBlockCstNode)[];
  RightCurlyBracket: (IToken)[];
  Retry?: IToken[];
  LeftParenthesis?: (IToken)[];
  actualNamedParameterList?: ActualNamedParameterListCstNode[];
  RightParenthesis?: (IToken)[];
  Catch?: IToken[];
  Identifier?: IToken[];
};

export interface ThrowStatementCstNode extends CstNode {
  name: "throwStatement";
  children: ThrowStatementCstChildren;
}

export type ThrowStatementCstChildren = {
  Throw: IToken[];
  expression: ExpressionCstNode[];
};

export interface ForStatementCstNode extends CstNode {
  name: "forStatement";
  children: ForStatementCstChildren;
}

export type ForStatementCstChildren = {
  For: IToken[];
  LeftParenthesis: IToken[];
  Identifier: IToken[];
  In: IToken[];
  expression: ExpressionCstNode[];
  RightParenthesis: IToken[];
  LeftCurlyBracket: IToken[];
  statementBlock: StatementBlockCstNode[];
  RightCurlyBracket: IToken[];
};

export interface BreakStatementCstNode extends CstNode {
  name: "breakStatement";
  children: BreakStatementCstChildren;
}

export type BreakStatementCstChildren = {
  Break: IToken[];
};

export interface ContinueStatementCstNode extends CstNode {
  name: "continueStatement";
  children: ContinueStatementCstChildren;
}

export type ContinueStatementCstChildren = {
  Continue: IToken[];
};

export interface BranchCstNode extends CstNode {
  name: "branch";
  children: BranchCstChildren;
}

export type BranchCstChildren = {
  Branch: IToken[];
  LeftCurlyBracket: IToken[];
  statementBlock: StatementBlockCstNode[];
  RightCurlyBracket: IToken[];
};

export interface ParallelStatementCstNode extends CstNode {
  name: "parallelStatement";
  children: ParallelStatementCstChildren;
}

export type ParallelStatementCstChildren = {
  Parallel: IToken[];
  LeftParenthesis?: IToken[];
  actualNamedParameterList?: ActualNamedParameterListCstNode[];
  RightParenthesis?: IToken[];
  branch?: BranchCstNode[];
  forStatement?: ForStatementCstNode[];
};

export interface ReturnStatementCstNode extends CstNode {
  name: "returnStatement";
  children: ReturnStatementCstChildren;
}

export type ReturnStatementCstChildren = {
  Return: IToken[];
  expression?: ExpressionCstNode[];
};

export interface StatementCstNode extends CstNode {
  name: "statement";
  children: StatementCstChildren;
}

export type StatementCstChildren = {
  callStatement?: CallStatementCstNode[];
  assignmentStatement?: AssignmentStatementCstNode[];
  ifStatement?: IfStatementCstNode[];
  forStatement?: ForStatementCstNode[];
  parallelStatement?: ParallelStatementCstNode[];
  tryStatement?: TryStatementCstNode[];
  throwStatement?: ThrowStatementCstNode[];
  breakStatement?: BreakStatementCstNode[];
  continueStatement?: ContinueStatementCstNode[];
  returnStatement?: ReturnStatementCstNode[];
};

export interface StatementBlockCstNode extends CstNode {
  name: "statementBlock";
  children: StatementBlockCstChildren;
}

export type StatementBlockCstChildren = {
  statement?: StatementCstNode[];
};

export interface FormalParameterCstNode extends CstNode {
  name: "formalParameter";
  children: FormalParameterCstChildren;
}

export type FormalParameterCstChildren = {
  Identifier: IToken[];
  Assignment?: IToken[];
  literal?: LiteralCstNode[];
};

export interface FormalParameterListCstNode extends CstNode {
  name: "formalParameterList";
  children: FormalParameterListCstChildren;
}

export type FormalParameterListCstChildren = {
  formalParameter?: FormalParameterCstNode[];
  Comma?: IToken[];
};

export interface SubworkflowDefinitionCstNode extends CstNode {
  name: "subworkflowDefinition";
  children: SubworkflowDefinitionCstChildren;
}

export type SubworkflowDefinitionCstChildren = {
  Workflow: IToken[];
  Identifier: IToken[];
  LeftParenthesis: IToken[];
  formalParameterList: FormalParameterListCstNode[];
  RightParenthesis: IToken[];
  LeftCurlyBracket: IToken[];
  statementBlock: StatementBlockCstNode[];
  RightCurlyBracket: IToken[];
};

export interface ProgramCstNode extends CstNode {
  name: "program";
  children: ProgramCstChildren;
}

export type ProgramCstChildren = {
  subworkflowDefinition?: SubworkflowDefinitionCstNode[];
};

export interface IWorkflowScriptCstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  object(children: ObjectCstChildren, param?: IN): OUT;
  objectItem(children: ObjectItemCstChildren, param?: IN): OUT;
  array(children: ArrayCstChildren, param?: IN): OUT;
  term(children: TermCstChildren, param?: IN): OUT;
  literal(children: LiteralCstChildren, param?: IN): OUT;
  expression(children: ExpressionCstChildren, param?: IN): OUT;
  parenthesizedExpression(children: ParenthesizedExpressionCstChildren, param?: IN): OUT;
  subscriptReference(children: SubscriptReferenceCstChildren, param?: IN): OUT;
  variableReference(children: VariableReferenceCstChildren, param?: IN): OUT;
  assignmentStatement(children: AssignmentStatementCstChildren, param?: IN): OUT;
  qualifiedIdentifier(children: QualifiedIdentifierCstChildren, param?: IN): OUT;
  actualAnonymousParameterList(children: ActualAnonymousParameterListCstChildren, param?: IN): OUT;
  actualNamedParameterList(children: ActualNamedParameterListCstChildren, param?: IN): OUT;
  actualParameterList(children: ActualParameterListCstChildren, param?: IN): OUT;
  callExpression(children: CallExpressionCstChildren, param?: IN): OUT;
  callStatement(children: CallStatementCstChildren, param?: IN): OUT;
  ifStatement(children: IfStatementCstChildren, param?: IN): OUT;
  tryStatement(children: TryStatementCstChildren, param?: IN): OUT;
  throwStatement(children: ThrowStatementCstChildren, param?: IN): OUT;
  forStatement(children: ForStatementCstChildren, param?: IN): OUT;
  breakStatement(children: BreakStatementCstChildren, param?: IN): OUT;
  continueStatement(children: ContinueStatementCstChildren, param?: IN): OUT;
  branch(children: BranchCstChildren, param?: IN): OUT;
  parallelStatement(children: ParallelStatementCstChildren, param?: IN): OUT;
  returnStatement(children: ReturnStatementCstChildren, param?: IN): OUT;
  statement(children: StatementCstChildren, param?: IN): OUT;
  statementBlock(children: StatementBlockCstChildren, param?: IN): OUT;
  formalParameter(children: FormalParameterCstChildren, param?: IN): OUT;
  formalParameterList(children: FormalParameterListCstChildren, param?: IN): OUT;
  subworkflowDefinition(children: SubworkflowDefinitionCstChildren, param?: IN): OUT;
  program(children: ProgramCstChildren, param?: IN): OUT;
}

