import type * as TypeScript from 'typescript';

export type ScenarioSourceCode = 'syntax' | 'duplicate-scene' | 'dynamic-scenes' | 'dynamic-scene-id' | 'spread-scenes' | 'no-scenes';
export interface ScenarioSourceDiagnostic {
  severity: 'error' | 'warning';
  code: ScenarioSourceCode;
  /** One-based location only; source fragments and property values are never returned. */
  line: number;
  column: number;
}
export interface ScenarioSourceResult {
  valid: boolean;
  errors: number;
  warnings: number;
  tables: number;
  scenes: number;
  diagnostics: ScenarioSourceDiagnostic[];
}

/** Parse inline JS scenes tables without evaluating the module or reporting its text. */
export async function lintScenarioSource(source: string): Promise<ScenarioSourceResult> {
  if (typeof source !== 'string') throw new TypeError('Scenario source must be a string.');
  let ts: typeof TypeScript;
  try { ts = (await import('typescript')).default; }
  catch (cause) { throw Object.assign(new Error('Source lint requires the optional parser: npm install typescript'), { code: 'SCENARIO_SOURCE_PARSER_MISSING', cause }); }
  const file = ts.createSourceFile('scenario.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const diagnostics: ScenarioSourceDiagnostic[] = [];
  let tables = 0, scenes = 0;
  const add = (severity: 'error' | 'warning', code: ScenarioSourceCode, position: number) => {
    const { line, character } = file.getLineAndCharacterOfPosition(position);
    diagnostics.push({ severity, code, line: line + 1, column: character + 1 });
  };
  const nameOf = (name: TypeScript.PropertyName): string | undefined => {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    if (ts.isNumericLiteral(name)) return String(Number(name.text));
    if (ts.isComputedPropertyName(name) && (ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression))) return name.expression.text;
    return undefined;
  };
  const unwrap = (node: TypeScript.Expression): TypeScript.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const visit = (node: TypeScript.Node) => {
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && nameOf(node.name) === 'scenes') {
      const value = ts.isPropertyAssignment(node) ? unwrap(node.initializer) : undefined;
      if (!value || !ts.isObjectLiteralExpression(value)) add('warning', 'dynamic-scenes', node.getStart(file));
      else {
        tables++;
        const ids = new Set<string>();
        for (const property of value.properties) {
          if (ts.isSpreadAssignment(property)) { add('warning', 'spread-scenes', property.getStart(file)); continue; }
          const id = nameOf(property.name);
          if (id === undefined) { add('warning', 'dynamic-scene-id', property.getStart(file)); continue; }
          if (ids.has(id)) add('error', 'duplicate-scene', property.name.getStart(file));
          ids.add(id);
        }
        scenes += ids.size;
      }
    }
    ts.forEachChild(node, visit);
  };
  // TypeScript's parser exposes parse diagnostics, while public SourceFile omits the member.
  const parsed = file as TypeScript.SourceFile & { parseDiagnostics: readonly TypeScript.Diagnostic[] };
  for (const diagnostic of parsed.parseDiagnostics) add('error', 'syntax', diagnostic.start ?? 0);
  if (!parsed.parseDiagnostics.length) visit(file);
  if (!tables && !diagnostics.length) add('warning', 'no-scenes', 0);
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  return { valid: errors === 0, errors, warnings: diagnostics.length - errors, tables, scenes, diagnostics };
}
