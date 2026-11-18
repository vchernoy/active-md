export { parse, parseExpression } from './parser.js';
export { evaluate, evaluateExpr, checkInputValue } from './evaluate.js';
export { createSession, type Session, type CompiledExpression } from './session.js';
export { formatNumber, parseFormat, parseUserNumber, type Format } from './format.js';
export { BUILTINS } from './builtins.js';
export { DEFAULT_LIMITS } from './types.js';
export type { Definition, Diagnostic, Expr, Limits, NameInfo, Program, Range, Result, Severity, Span } from './types.js';
export { checkAnswer, type NumericAnswerOptions, type NumericAnswerCheck } from './answer.js';
export { checkChoiceAnswer, type ChoiceOption, type ChoiceMode, type ChoiceAnswerCheck } from './choice-answer.js';
