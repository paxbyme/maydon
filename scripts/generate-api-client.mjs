import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const input = readFileSync('docs/openapi.json', 'utf8');
const document = JSON.parse(input);
const schemas = document.components.schemas;
const target = 'packages/api_client/lib/generated/api.g.dart';
const identifier = /^[a-zA-Z][a-zA-Z0-9]*$/;
function name(value) {
  assert.match(value, identifier);
  return value;
}
function type(schema) {
  if (schema.$ref) return name(schema.$ref.split('/').at(-1));
  const result = {
    string: 'String',
    boolean: 'bool',
    integer: 'int',
    number: 'num',
  }[schema.type];
  assert.ok(
    result,
    `Unsupported schema; extend generator deliberately: ${JSON.stringify(schema)}`,
  );
  return result;
}
let output = `// GENERATED from docs/openapi.json. Do not edit.\n// Contract SHA-256: ${createHash('sha256').update(input).digest('hex')}\n// dart format off\nimport 'package:dio/dio.dart';\n\n`;
for (const [className, schema] of Object.entries(schemas)) {
  name(className);
  assert.equal(schema.type, 'object');
  const fields = Object.entries(schema.properties ?? {}).map(
    ([key, value]) => ({
      key: name(key),
      schema: value,
      type: type(value),
      required: schema.required?.includes(key) ?? false,
    }),
  );
  output += `class ${className} {\n  const ${className}({${fields.map((field) => `${field.required ? 'required ' : ''}this.${field.key}`).join(', ')}});\n`;
  for (const field of fields)
    output += `  final ${field.type}${!field.required || field.schema.nullable ? '?' : ''} ${field.key};\n`;
  output += `  factory ${className}.fromJson(Map<String, dynamic> json) => ${className}(\n`;
  for (const field of fields) {
    const access = `json['${field.key}']`;
    let parsed = field.schema.$ref
      ? `${field.type}.fromJson(${access} as Map<String, dynamic>)`
      : `${access} as ${field.type}`;
    if (!field.required || field.schema.nullable)
      parsed = `${access} == null ? null : ${parsed}`;
    output += `    ${field.key}: ${parsed},\n`;
  }
  output += `  );\n  Map<String, dynamic> toJson() => {\n`;
  for (const field of fields)
    output += `    ${!field.required ? `if (${field.key} != null) ` : ''}'${field.key}': ${field.key}${field.schema.$ref ? `${!field.required || field.schema.nullable ? '?' : ''}.toJson()` : ''},\n`;
  output += `  };\n}\n\n`;
}
output +=
  'class MaydonApi {\n  MaydonApi(this.transport);\n  final Dio transport;\n';
const methods = new Set();
for (const [path, operations] of Object.entries(document.paths)) {
  for (const [verb, operation] of Object.entries(operations)) {
    assert.ok(['get', 'post', 'put', 'patch', 'delete'].includes(verb));
    const method = operation.operationId
      .replace(/Controller_([a-z])/, (_, letter) => letter.toUpperCase())
      .replace(/^./, (first) => first.toLowerCase());
    name(method);
    assert.ok(!methods.has(method));
    methods.add(method);
    const parameters = operation.parameters ?? [];
    assert.ok(
      parameters.every((parameter) => parameter.in === 'path'),
      'Add query/header generation before publishing such a contract',
    );
    const args = parameters.map(
      (parameter) => `required String ${name(parameter.name)}`,
    );
    const body = operation.requestBody?.content?.['application/json']?.schema;
    if (body) args.push(`required ${type(body)} body`);
    args.push('Map<String, dynamic>? headers');
    const responseSchema = Object.entries(operation.responses).find(([code]) =>
      /^2\d\d$/.test(code),
    )?.[1]?.content?.['application/json']?.schema;
    const responseType = responseSchema
      ? type(responseSchema)
      : 'Map<String, dynamic>';
    const interpolatedPath = path.replace(
      /\{(\w+)\}/g,
      (_, key) => '${Uri.encodeComponent(' + name(key) + ')}',
    );
    output += `  Future<${responseType}> ${method}({${args.join(', ')}}) async {\n    final response = await transport.request<Map<String, dynamic>>(\n      '${interpolatedPath}',\n      ${body ? 'data: body.toJson(),\n      ' : ''}options: Options(method: '${verb.toUpperCase()}', headers: headers),\n    );\n    return ${responseSchema ? `${responseType}.fromJson(response.data!)` : 'response.data!'};\n  }\n`;
  }
}
output += '}\n// dart format on\n';
if (process.argv.includes('--check')) {
  assert.equal(
    readFileSync(target, 'utf8'),
    output,
    'Dart API contract drift: run node scripts/generate-api-client.mjs',
  );
  console.log('Generated Dart client matches OpenAPI.');
} else {
  writeFileSync(target, output);
  console.log(
    `Generated ${Object.keys(schemas).length} models and ${methods.size} operations.`,
  );
}
