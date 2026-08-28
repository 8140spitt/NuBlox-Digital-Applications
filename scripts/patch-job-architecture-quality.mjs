#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const generatorPath = path.join(repoRoot, 'scripts', 'generate-job-architecture.mjs');

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`${label}: expected source block was not found`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`${label}: expected exactly one source block`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let source = await readFile(generatorPath, 'utf8');

source = replaceOnce(
  source,
  'skill rule scopes',
  "];\n\nfunction titleCase(value) {",
  `];\n\nconst skillRuleScopes = [\n  ['F01', 'F04', 'F28'],\n  ['F02', 'F20', 'F21'],\n  ['F01', 'F03', 'F27', 'F29'],\n  ['F05'],\n  ['F06'],\n  ['F07'],\n  ['F08', 'F12'],\n  ['F09'],\n  ['F10'],\n  ['F11'],\n  ['F13'],\n  ['F14'],\n  ['F15'],\n  ['F16'],\n  ['F15', 'F17'],\n  ['F18'],\n  ['F19'],\n  ['F20', 'F23', 'F24'],\n  ['F21'],\n  ['F22'],\n  ['F23'],\n  ['F24'],\n  ['F25'],\n  ['F26'],\n  ['F22', 'F27'],\n  ['F28'],\n  ['F29'],\n];\n\nif (skillRuleScopes.length !== skillRules.length) {\n  throw new Error('Every generated skill rule must have an explicit enterprise-function scope.');\n}\n\nfunction titleCase(value) {`,
);

source = replaceOnce(
  source,
  'scoped skill inference',
  `function inferSkills(roleName, activities) {\n  const haystack = \`\${roleName} \${activities.join(' ')}\`;\n  const skills = new Set(['Business communication', 'Record and evidence management']);\n  for (const [rule, values] of skillRules) {\n    if (rule.test(haystack)) values.forEach((value) => skills.add(value));\n  }\n  return [...skills].slice(0, 8);\n}`,
  `function inferSkills(functionId, roleName, activities) {\n  const haystack = \`\${roleName} \${activities.join(' ')}\`;\n  const skills = new Set(['Business communication', 'Record and evidence management']);\n\n  for (const [[rule, values], scopes] of skillRules.map((rule, index) => [\n    rule,\n    skillRuleScopes[index],\n  ])) {\n    if (!scopes.includes(functionId)) continue;\n    if (rule.test(haystack)) values.forEach((value) => skills.add(value));\n  }\n\n  return [...skills].slice(0, 8);\n}`,
);

source = replaceOnce(
  source,
  'functional role skill call',
  'knowledgeAndSkills: inferSkills(roleName, subfunction.activities),',
  'knowledgeAndSkills: inferSkills(fn.id, roleName, subfunction.activities),',
);

source = replaceOnce(
  source,
  'specialist profile skill call',
  'knowledgeAndTechnicalSkills: inferSkills(roleName, subfunction.activities),',
  'knowledgeAndTechnicalSkills: inferSkills(fn.id, roleName, subfunction.activities),',
);

source = replaceOnce(
  source,
  'function lead skill call',
  `knowledgeAndTechnicalSkills: inferSkills(\n      fn.name,\n      fn.subfunctions.flatMap((subfunction) => subfunction.activities),\n    ),`,
  `knowledgeAndTechnicalSkills: inferSkills(\n      fn.id,\n      fn.name,\n      fn.subfunctions.flatMap((subfunction) => subfunction.activities),\n    ),`,
);

source = replaceOnce(
  source,
  'deterministic coverage metadata',
  'generatedAt: new Date().toISOString(),',
  'generatorVersion: 2,',
);

source = replaceOnce(
  source,
  'generated artifact versions',
  `['job-families.generated.json', { version: 1, jobFamilies }],\n    ['functional-roles.generated.json', { version: 1, functionalRoles }],\n    ['job-profiles.generated.json', { version: 1, jobProfiles }],`,
  `['job-families.generated.json', { version: 2, jobFamilies }],\n    ['functional-roles.generated.json', { version: 2, functionalRoles }],\n    ['job-profiles.generated.json', { version: 2, jobProfiles }],`,
);

source = replaceOnce(
  source,
  'quality validation function',
  `function buildMarkdown(functions, roles, profiles) {`,
  `function validateGeneratedQuality(functions, functionalRoles, jobProfiles, coverage) {\n  if (functions.length !== 29) throw new Error(\`Expected 29 enterprise functions, found \${functions.length}.\`);\n  if (functionalRoles.length !== 353) {\n    throw new Error(\`Expected 353 functional roles, found \${functionalRoles.length}.\`);\n  }\n  if (jobProfiles.length !== 382) {\n    throw new Error(\`Expected 382 candidate job profiles, found \${jobProfiles.length}.\`);\n  }\n  if (coverage.source.activities !== 1510) {\n    throw new Error(\`Expected 1,510 source activities, found \${coverage.source.activities}.\`);\n  }\n  if (!coverage.coverage.allFunctionsCovered || !coverage.coverage.allSubfunctionsCovered) {\n    throw new Error('Generated job architecture does not fully cover the enterprise taxonomy.');\n  }\n\n  const profileById = new Map(jobProfiles.map((profile) => [profile.id, profile]));\n  const assertExcludes = (profileId, forbiddenSkills) => {\n    const profile = profileById.get(profileId);\n    if (!profile) throw new Error(\`Missing regression profile \${profileId}.\`);\n    const leaked = forbiddenSkills.filter((skill) => profile.knowledgeAndTechnicalSkills.includes(skill));\n    if (leaked.length > 0) {\n      throw new Error(\`\${profileId} contains cross-function skill leakage: \${leaked.join(', ')}.\`);\n    }\n  };\n\n  assertExcludes('JP-F01.02-PROFESSIONAL', [\n    'Human resources',\n    'People operations',\n    'Customer relationship management',\n    'Revenue management',\n  ]);\n  assertExcludes('JP-F01.05-PROFESSIONAL', [\n    'Commercial judgement',\n    'Customer relationship management',\n    'Revenue management',\n    'Quality management',\n    'Root-cause analysis',\n    'Control assurance',\n  ]);\n}\n\nfunction buildMarkdown(functions, roles, profiles) {`,
);

source = replaceOnce(
  source,
  'quality validation call',
  `const coverage = buildCoverage(functions, functionalRoles, jobProfiles);\n  const markdown = buildMarkdown(functions, functionalRoles, jobProfiles);`,
  `const coverage = buildCoverage(functions, functionalRoles, jobProfiles);\n  validateGeneratedQuality(functions, functionalRoles, jobProfiles, coverage);\n  const markdown = buildMarkdown(functions, functionalRoles, jobProfiles);`,
);

await writeFile(generatorPath, source, 'utf8');

const generated = spawnSync(process.execPath, ['scripts/generate-job-architecture.mjs'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (generated.status !== 0) process.exit(generated.status ?? 1);
