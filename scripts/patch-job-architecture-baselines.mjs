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
  'function skill baselines',
  'const skillRules = [',
  `const functionSkillBaselines = {\n  F01: ['Strategic analysis', 'Scenario planning', 'Decision support'],\n  F02: ['Governance', 'Policy management', 'Decision-rights management'],\n  F03: ['Performance management', 'KPI design', 'Analytical interpretation'],\n  F04: ['Strategic analysis', 'Commercial judgement', 'Decision support'],\n  F05: ['Product management', 'Requirements analysis', 'Lifecycle management'],\n  F06: ['Marketing planning', 'Audience insight', 'Campaign measurement'],\n  F07: ['Commercial judgement', 'Customer relationship management', 'Revenue management'],\n  F08: ['Customer service', 'Case management', 'Customer communication'],\n  F09: ['Procurement', 'Supplier management', 'Commercial negotiation'],\n  F10: ['Supply chain planning', 'Inventory management', 'Operational coordination'],\n  F11: ['Production operations', 'Operational control', 'Continuous improvement'],\n  F12: ['Service delivery', 'Operational coordination', 'Customer communication'],\n  F13: ['Quality management', 'Root-cause analysis', 'Control assurance'],\n  F14: ['Financial analysis', 'Financial control', 'Accounting / finance operations'],\n  F15: ['Human resources', 'People operations', 'Stakeholder management'],\n  F16: ['Technology delivery', 'IT service management', 'Technical problem solving'],\n  F17: ['Data management', 'Analytics', 'Data governance'],\n  F18: ['Information security', 'Risk assessment', 'Security controls'],\n  F19: ['Legal analysis', 'Contract interpretation', 'Regulatory awareness'],\n  F20: ['Risk management', 'Compliance', 'Assurance'],\n  F21: ['Privacy management', 'Information governance', 'Regulatory compliance'],\n  F22: ['Asset management', 'Facilities operations', 'Lifecycle planning'],\n  F23: ['HSE management', 'Risk control', 'Sustainability'],\n  F24: ['Business resilience', 'Incident coordination', 'Crisis response'],\n  F25: ['Communications', 'Stakeholder engagement', 'Reputation management'],\n  F26: ['Information management', 'Records governance', 'Knowledge management'],\n  F27: ['Project management', 'Planning and control', 'Stakeholder management'],\n  F28: ['Change management', 'Stakeholder engagement', 'Adoption planning'],\n  F29: ['Business process management', 'Process analysis', 'Continuous improvement'],\n};\n\nconst skillRules = [`,
);

source = replaceOnce(
  source,
  'baseline skill application',
  `const skills = new Set(['Business communication', 'Record and evidence management']);\n\n  for (const [[rule, values], scopes] of skillRules.map((rule, index) => [`,
  `const skills = new Set(['Business communication', 'Record and evidence management']);\n  const baseline = functionSkillBaselines[functionId];\n  if (!baseline) throw new Error(\`Missing skill baseline for enterprise function \${functionId}.\`);\n  baseline.forEach((value) => skills.add(value));\n\n  for (const [[rule, values], scopes] of skillRules.map((rule, index) => [`,
);

source = replaceOnce(
  source,
  'quality baseline assertions',
  `assertExcludes('JP-F01.05-PROFESSIONAL', [\n    'Commercial judgement',\n    'Customer relationship management',\n    'Revenue management',\n    'Quality management',\n    'Root-cause analysis',\n    'Control assurance',\n  ]);`,
  `assertExcludes('JP-F01.05-PROFESSIONAL', [\n    'Commercial judgement',\n    'Customer relationship management',\n    'Revenue management',\n    'Quality management',\n    'Root-cause analysis',\n    'Control assurance',\n  ]);\n\n  const assertIncludes = (profileId, expectedSkills) => {\n    const profile = profileById.get(profileId);\n    if (!profile) throw new Error(\`Missing regression profile \${profileId}.\`);\n    const missing = expectedSkills.filter((skill) => !profile.knowledgeAndTechnicalSkills.includes(skill));\n    if (missing.length > 0) {\n      throw new Error(\`\${profileId} is missing its enterprise-function skill baseline: \${missing.join(', ')}.\`);\n    }\n  };\n\n  assertIncludes('JP-F01.02-PROFESSIONAL', [\n    'Strategic analysis',\n    'Scenario planning',\n    'Decision support',\n  ]);\n  assertIncludes('JP-F01.05-PROFESSIONAL', [\n    'Strategic analysis',\n    'Scenario planning',\n    'Decision support',\n  ]);`,
);

await writeFile(generatorPath, source, 'utf8');

const generated = spawnSync(process.execPath, ['scripts/generate-job-architecture.mjs'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (generated.status !== 0) process.exit(generated.status ?? 1);
