#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const taxonomyDir = path.join(repoRoot, 'docs', 'architecture', 'taxonomy');
const outputDir = path.join(repoRoot, 'docs', 'architecture', 'job-architecture', 'generated');

const shards = [
  'taxonomy-f01-f08.json',
  'taxonomy-f09-f15.json',
  'taxonomy-f16-f22.json',
  'taxonomy-f23-f29.json',
];

const functionLeadTitles = {
  F01: 'Head of Strategy & Enterprise Planning',
  F02: 'Head of Corporate Governance',
  F03: 'Head of Enterprise Performance',
  F04: 'Head of Corporate Development',
  F05: 'Head of Product, Service & Innovation',
  F06: 'Head of Marketing & Brand',
  F07: 'Head of Sales & Commercial',
  F08: 'Head of Customer Experience & Success',
  F09: 'Head of Procurement & Supplier Management',
  F10: 'Head of Supply Chain & Logistics',
  F11: 'Head of Manufacturing / Production Operations',
  F12: 'Head of Service Delivery & Field Operations',
  F13: 'Head of Quality',
  F14: 'Head of Finance',
  F15: 'Head of Human Resources',
  F16: 'Head of Information Technology',
  F17: 'Head of Data, Analytics & AI',
  F18: 'Head of Cybersecurity & Information Security',
  F19: 'Head of Legal & Corporate Secretariat',
  F20: 'Head of Risk, Compliance & Assurance',
  F21: 'Head of Privacy & Information Governance',
  F22: 'Head of Property, Facilities & Physical Assets',
  F23: 'Head of HSE & Sustainability',
  F24: 'Head of Business Continuity, Crisis & Physical Security',
  F25: 'Head of Communications, Public Affairs & Investor Relations',
  F26: 'Head of Knowledge, Document & Records Management',
  F27: 'Head of Portfolio, Programme & Project Management',
  F28: 'Head of Change & Transformation',
  F29: 'Head of Business Process & Continuous Improvement',
};

const specialistTitleOverrides = {
  'Vision & purpose': 'Strategy & Purpose Specialist',
  'Environmental analysis': 'Strategic Analysis Specialist',
  'Strategic planning': 'Strategic Planning Manager',
  'Business planning': 'Business Planning Manager',
  'Operating model': 'Operating Model Specialist',
  'Goal & KPI management': 'Performance & KPI Manager',
  'Strategic review': 'Strategy Performance Manager',
  'Scenario & foresight planning': 'Scenario & Foresight Specialist',
  'Board governance': 'Board Governance Manager',
  'Executive management': 'Executive Governance Manager',
  'Market/customer needs': 'Customer & Market Insights Specialist',
  'Product/service ideation': 'Product Innovation Specialist',
  'Product/service design': 'Product / Service Designer',
  'Lead generation': 'Demand Generation Specialist',
  'Opportunity management': 'Business Development Manager',
  'Proposal/bid management': 'Bid & Proposal Manager',
  'Returns/refunds': 'Returns & Refunds Specialist',
  'Customer knowledge': 'Customer Knowledge Manager',
  'Procurement strategy': 'Procurement Strategy Manager',
  'Supplier discovery': 'Supplier Sourcing Specialist',
  Sourcing: 'Strategic Sourcing Specialist',
  'Supplier negotiation': 'Supplier Commercial Manager',
  Contracting: 'Procurement Contracts Manager',
  Requisitioning: 'Procurement Operations Specialist',
  'Purchase ordering': 'Buyer',
  'Sales & operations planning': 'S&OP Manager',
  'Material requirements': 'Materials Planner',
  'Warehouse management': 'Warehouse Manager',
  'Inventory control': 'Inventory Controller',
  'Transport management': 'Transport Manager',
  Distribution: 'Distribution Manager',
  'Import/export': 'Import / Export Specialist',
  'Reverse logistics': 'Reverse Logistics Specialist',
  'Production planning': 'Production Planner',
  'Production scheduling': 'Production Scheduler',
  'Production execution': 'Production Supervisor',
  'Process control': 'Process Control Specialist',
  'Work-in-progress': 'WIP Controller',
  Packaging: 'Packaging Supervisor',
  'Lean operations': 'Lean Improvement Specialist',
  'Service scheduling': 'Service Scheduler',
  'Resource dispatch': 'Service Dispatcher',
  'Service execution': 'Service Delivery Specialist',
  'Field service': 'Field Service Engineer',
  'Professional services': 'Professional Services Consultant',
  'Quality assurance': 'Quality Assurance Specialist',
  'Quality control': 'Quality Control Inspector',
  'Non-conformance': 'Non-Conformance Coordinator',
  'Corrective/preventive action': 'CAPA Specialist',
  'Supplier quality': 'Supplier Quality Engineer',
  'General ledger': 'General Ledger Accountant',
  'Accounts payable': 'Accounts Payable Specialist',
  'Accounts receivable': 'Accounts Receivable Specialist',
  'Credit management': 'Credit Controller',
  Collections: 'Collections Specialist',
  'Fixed asset accounting': 'Fixed Asset Accountant',
  'Cost accounting': 'Cost Accountant',
  'Financial close': 'Financial Close Accountant',
  Consolidation: 'Group Consolidation Accountant',
  'Financial reporting': 'Financial Reporting Accountant',
  Treasury: 'Treasury Specialist',
  Payments: 'Payments Specialist',
  'Foreign exchange': 'Treasury FX Specialist',
  'Debt & financing': 'Corporate Finance Specialist',
  Tax: 'Tax Specialist',
  'Financial controls': 'Financial Controls Manager',
  'Profitability analysis': 'Commercial Finance Analyst',
  'Capital expenditure': 'Capital Investment Analyst',
  'People strategy': 'People Strategy Manager',
  'Workforce planning': 'Workforce Planning Specialist',
  'Organisation design': 'Organisation Design Specialist',
  'Job architecture': 'Job Architecture Specialist',
  Recruitment: 'Talent Acquisition Specialist',
  'Pre-employment': 'Pre-Employment Screening Specialist',
  Onboarding: 'Employee Onboarding Specialist',
  'Employee administration': 'HR Operations Specialist',
  'Time & attendance': 'Time & Attendance Specialist',
  Payroll: 'Payroll Specialist',
  Compensation: 'Compensation Specialist',
  Benefits: 'Benefits Specialist',
  'Performance management': 'Performance Management Specialist',
  'Learning & development': 'Learning & Development Specialist',
  'Talent management': 'Talent Management Specialist',
  'Employee engagement': 'Employee Engagement Specialist',
  'Employee relations': 'Employee Relations Specialist',
  'Absence management': 'Absence Management Specialist',
  Offboarding: 'Employee Offboarding Specialist',
  'HR analytics': 'People Analytics Specialist',
  'IT strategy': 'IT Strategy Manager',
  'Enterprise architecture': 'Enterprise Architect',
  'Solution architecture': 'Solution Architect',
  'Application management': 'Application Manager',
  'Software development': 'Software Engineer',
  DevOps: 'DevOps Engineer',
  Infrastructure: 'Infrastructure Engineer',
  'Cloud management': 'Cloud Engineer',
  'Network management': 'Network Engineer',
  'Endpoint management': 'Endpoint Engineer',
  'Identity administration': 'Identity Administrator',
  'IT service desk': 'IT Service Desk Analyst',
  'Incident management': 'IT Incident Manager',
  'Problem management': 'IT Problem Manager',
  'Change management': 'IT Change Manager',
  'Release management': 'Release Manager',
  'Configuration management': 'Configuration Manager',
  'IT asset management': 'IT Asset Manager',
  'Availability/capacity': 'IT Capacity & Availability Manager',
  'Disaster recovery': 'IT Disaster Recovery Manager',
  'Technology vendor management': 'Technology Vendor Manager',
  'Data strategy': 'Data Strategy Manager',
  'Data governance': 'Data Governance Manager',
  'Data architecture': 'Data Architect',
  'Master data management': 'Master Data Specialist',
  'Reference data': 'Reference Data Specialist',
  'Data quality': 'Data Quality Specialist',
  'Data engineering': 'Data Engineer',
  'Data platform': 'Data Platform Engineer',
  'BI/reporting': 'BI Developer',
  Analytics: 'Data Analyst',
  'Data science': 'Data Scientist',
  'AI development': 'AI Engineer',
  'AI governance': 'AI Governance Specialist',
  'Model operations': 'MLOps Engineer',
  'Metadata/catalogue': 'Metadata & Data Catalogue Specialist',
  'Data access': 'Data Access Administrator',
  'Data lifecycle': 'Data Lifecycle Specialist',
  'Security strategy': 'Security Strategy Manager',
  'Security policy': 'Information Security Policy Specialist',
  'Security architecture': 'Security Architect',
  'Identity & access security': 'IAM Security Engineer',
  'Vulnerability management': 'Vulnerability Management Specialist',
  'Patch security': 'Security Patch Specialist',
  'Security monitoring': 'SOC Analyst',
  'Security incident response': 'Cyber Incident Responder',
  'Threat intelligence': 'Threat Intelligence Analyst',
  'Penetration testing': 'Penetration Tester',
  'Application security': 'Application Security Engineer',
  'Third-party security': 'Third-Party Security Risk Specialist',
  'Security awareness': 'Security Awareness Specialist',
  Cryptography: 'Cryptography & PKI Specialist',
  'Security compliance': 'Security Compliance Specialist',
  'Legal advisory': 'Legal Counsel',
  'Contract management': 'Commercial Contracts Counsel',
  'Contract repository': 'Contract Administrator',
  'Corporate legal': 'Corporate Counsel',
  'Company secretariat': 'Company Secretary',
  'Intellectual property': 'Intellectual Property Counsel',
  Litigation: 'Litigation Counsel',
  'Regulatory legal': 'Regulatory Counsel',
  'Employment legal': 'Employment Counsel',
  'Legal spend': 'Legal Operations Specialist',
  'Legal hold/eDiscovery': 'eDiscovery Specialist',
  'Legal obligations': 'Legal Obligations Manager',
  'Risk framework': 'Enterprise Risk Manager',
  'Risk identification': 'Risk Analyst',
  'Risk assessment': 'Risk Analyst',
  'Risk treatment': 'Risk Manager',
  'Risk monitoring': 'Risk Monitoring Analyst',
  'Regulatory compliance': 'Compliance Manager',
  'Compliance monitoring': 'Compliance Monitoring Specialist',
  'Control management': 'Internal Controls Specialist',
  'Control testing': 'Controls Assurance Specialist',
  'Internal audit planning': 'Internal Audit Manager',
  'Audit execution': 'Internal Auditor',
  'Audit reporting': 'Internal Audit Manager',
  'Issue/remediation': 'Remediation Manager',
  'Fraud risk': 'Fraud Risk Specialist',
  'Ethics & conduct': 'Ethics & Conduct Officer',
  'Assurance coordination': 'Assurance Manager',
  'Privacy governance': 'Privacy Manager',
  'Processing inventory': 'Privacy Operations Specialist',
  'Privacy impact assessment': 'Privacy Risk Specialist',
  'Consent/preferences': 'Consent & Preferences Specialist',
  'Data subject rights': 'Data Rights Specialist',
  'Privacy incidents': 'Privacy Incident Manager',
  'International transfers': 'International Data Transfer Specialist',
  Retention: 'Information Retention Specialist',
  'Privacy assurance': 'Privacy Assurance Specialist',
  'Asset strategy': 'Asset Strategy Manager',
  'Capital planning': 'Capital Planning Manager',
  'Asset acquisition': 'Asset Acquisition Specialist',
  'Property acquisition': 'Property Acquisition Manager',
  'Construction/project delivery': 'Construction Project Manager',
  'Asset register': 'Asset Information Manager',
  'Preventive maintenance': 'Maintenance Planner',
  'Reactive maintenance': 'Maintenance Coordinator',
  Reliability: 'Reliability Engineer',
  'Facilities operations': 'Facilities Manager',
  'Space management': 'Space Planning Manager',
  'Lease management': 'Lease Manager',
  'Utilities management': 'Utilities Manager',
  'Asset disposal': 'Asset Disposal Specialist',
  'H&S management': 'Health & Safety Manager',
  'Hazard identification': 'Health & Safety Risk Specialist',
  'Workplace inspections': 'Safety Inspector',
  'Incident management': 'Safety Incident Investigator',
  'Occupational health': 'Occupational Health Specialist',
  'Permit-to-work': 'Permit-to-Work Coordinator',
  'Environmental management': 'Environmental Manager',
  'Waste management': 'Waste Management Specialist',
  'Carbon management': 'Carbon Manager',
  'Energy management': 'Energy Manager',
  'Sustainability strategy': 'Sustainability Manager',
  'ESG reporting': 'ESG Reporting Specialist',
  'Sustainable supply chain': 'Sustainable Procurement Specialist',
  'Environmental compliance': 'Environmental Compliance Specialist',
  'Business continuity governance': 'Business Continuity Manager',
  'Business impact analysis': 'Business Continuity Analyst',
  'Continuity planning': 'Business Continuity Planner',
  'Continuity testing': 'Business Continuity Exercise Specialist',
  'Crisis management': 'Crisis Manager',
  'Emergency response': 'Emergency Response Coordinator',
  'Crisis communications': 'Crisis Communications Manager',
  'Disaster recovery coordination': 'Disaster Recovery Coordinator',
  'Physical security': 'Physical Security Manager',
  'Visitor management': 'Security Operations Coordinator',
  'Security investigations': 'Security Investigator',
  'Travel security': 'Travel Security Specialist',
  'Corporate communications': 'Corporate Communications Manager',
  'Internal communications': 'Internal Communications Manager',
  'Media relations': 'Media Relations Manager',
  'Public relations': 'Public Relations Manager',
  'Reputation management': 'Reputation Manager',
  'Public affairs': 'Public Affairs Manager',
  'Government relations': 'Government Relations Manager',
  'Investor relations': 'Investor Relations Manager',
  'Annual reporting': 'Annual Reporting Manager',
  'Stakeholder engagement': 'Stakeholder Engagement Manager',
  'Community relations': 'Community Relations Manager',
  'Knowledge strategy': 'Knowledge Manager',
  'Knowledge capture': 'Knowledge Capture Specialist',
  'Knowledge sharing': 'Knowledge & Collaboration Specialist',
  'Knowledge maintenance': 'Knowledge Curator',
  'Document management': 'Document Controller',
  'Records management': 'Records Manager',
  'Controlled documents': 'Controlled Documents Coordinator',
  'Records retention': 'Records Retention Specialist',
  'Enterprise search': 'Enterprise Search Specialist',
  'Lessons learned': 'Lessons Learned Coordinator',
  'Portfolio management': 'Portfolio Manager',
  'Investment governance': 'Investment Governance Manager',
  'Programme management': 'Programme Manager',
  'Project initiation': 'Project Manager',
  'Project planning': 'Project Planner',
  'Project execution': 'Project Manager',
  'Project control': 'Project Controls Manager',
  'Project closure': 'Project Manager',
  PMO: 'PMO Manager',
  'Resource management': 'Portfolio Resource Manager',
  'Transformation strategy': 'Transformation Director',
  'Change impact assessment': 'Change Analyst',
  'Stakeholder management': 'Change Stakeholder Manager',
  'Change communications': 'Change Communications Manager',
  'Training/readiness': 'Change Readiness & Training Lead',
  'Adoption management': 'Adoption Manager',
  'Organisational transition': 'Organisational Transition Manager',
  'Benefits tracking': 'Benefits Realisation Manager',
  'Process architecture': 'Business Process Architect',
  'Process ownership': 'Process Governance Manager',
  'Process modelling': 'Business Process Analyst',
  'Process analysis': 'Business Process Analyst',
  'Process redesign': 'Process Improvement Specialist',
  'SOP management': 'SOP & Process Documentation Specialist',
  'Workflow automation': 'Workflow Automation Specialist',
  'Continuous improvement': 'Continuous Improvement Specialist',
  'Process compliance': 'Process Compliance Specialist',
  'Process performance': 'Process Performance Analyst',
};

const skillRules = [
  [/strategy|strategic|scenario|foresight/i, ['Strategic analysis', 'Scenario planning', 'Decision support']],
  [/governance|board|committee|policy|authority/i, ['Governance', 'Policy management', 'Decision-rights management']],
  [/performance|KPI|benchmark|benefit/i, ['Performance management', 'KPI design', 'Analytical interpretation']],
  [/product|service design|innovation|portfolio/i, ['Product management', 'Requirements analysis', 'Lifecycle management']],
  [/marketing|brand|campaign|content|market/i, ['Marketing planning', 'Audience insight', 'Campaign measurement']],
  [/sales|account|opportunity|pipeline|pricing|quotation|proposal|bid/i, ['Commercial judgement', 'Customer relationship management', 'Revenue management']],
  [/customer|complaint|case|support|warranty|retention/i, ['Customer service', 'Case management', 'Customer communication']],
  [/procurement|supplier|sourcing|requisition|purchase/i, ['Procurement', 'Supplier management', 'Commercial negotiation']],
  [/demand|supply|inventory|warehouse|transport|distribution|logistics/i, ['Supply chain planning', 'Inventory management', 'Operational coordination']],
  [/production|manufacturing|WIP|packaging|lean/i, ['Production operations', 'Operational control', 'Continuous improvement']],
  [/quality|non-conformance|CAPA|inspection/i, ['Quality management', 'Root-cause analysis', 'Control assurance']],
  [/finance|account|ledger|treasury|tax|credit|payment|budget|forecast/i, ['Financial analysis', 'Financial control', 'Accounting / finance operations']],
  [/people|workforce|HR|employee|payroll|compensation|benefit|talent|learning/i, ['Human resources', 'People operations', 'Stakeholder management']],
  [/architecture|software|DevOps|cloud|network|endpoint|IT service|incident|release|configuration/i, ['Technology delivery', 'IT service management', 'Technical problem solving']],
  [/data|analytics|AI|model|metadata|BI/i, ['Data management', 'Analytics', 'Data governance']],
  [/security|vulnerability|threat|penetration|cryptography/i, ['Information security', 'Risk assessment', 'Security controls']],
  [/legal|contract|litigation|intellectual property/i, ['Legal analysis', 'Contract interpretation', 'Regulatory awareness']],
  [/risk|compliance|control|audit|fraud|ethics|assurance/i, ['Risk management', 'Compliance', 'Assurance']],
  [/privacy|consent|data subject|retention/i, ['Privacy management', 'Information governance', 'Regulatory compliance']],
  [/asset|property|facilities|maintenance|lease|utilities/i, ['Asset management', 'Facilities operations', 'Lifecycle planning']],
  [/safety|hazard|environment|waste|carbon|energy|ESG|sustainability/i, ['HSE management', 'Risk control', 'Sustainability']],
  [/continuity|crisis|emergency|physical security|travel security/i, ['Business resilience', 'Incident coordination', 'Crisis response']],
  [/communications|media|public affairs|investor|stakeholder|community/i, ['Communications', 'Stakeholder engagement', 'Reputation management']],
  [/knowledge|document|records|search|lessons/i, ['Information management', 'Records governance', 'Knowledge management']],
  [/portfolio|programme|project|PMO|resource management/i, ['Project management', 'Planning and control', 'Stakeholder management']],
  [/change|transformation|adoption|readiness|transition/i, ['Change management', 'Stakeholder engagement', 'Adoption planning']],
  [/process|workflow|continuous improvement|SOP/i, ['Business process management', 'Process analysis', 'Continuous improvement']],
];

const skillRuleScopes = [
  ['F01', 'F04', 'F28'],
  ['F02', 'F20', 'F21'],
  ['F01', 'F03', 'F27', 'F29'],
  ['F05'],
  ['F06'],
  ['F07'],
  ['F08', 'F12'],
  ['F09'],
  ['F10'],
  ['F11'],
  ['F13'],
  ['F14'],
  ['F15'],
  ['F16'],
  ['F15', 'F17'],
  ['F18'],
  ['F19'],
  ['F20', 'F23', 'F24'],
  ['F21'],
  ['F22'],
  ['F23'],
  ['F24'],
  ['F25'],
  ['F26'],
  ['F22', 'F27'],
  ['F28'],
  ['F29'],
];

if (skillRuleScopes.length !== skillRules.length) {
  throw new Error('Every generated skill rule must have an explicit enterprise-function scope.');
}

function titleCase(value) {
  const keepLower = new Set(['and', 'or', 'of', 'to', 'for', 'in']);
  return value
    .split(/\s+/)
    .map((word, index) => {
      if (word === '&' || word === '/' || /[A-Z]{2,}/.test(word)) return word;
      if (index > 0 && keepLower.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function canonicalRoleName(subfunctionName) {
  return titleCase(subfunctionName.replace(/\s*\/\s*/g, ' / '));
}

function specialistJobTitle(subfunctionName) {
  if (specialistTitleOverrides[subfunctionName]) return specialistTitleOverrides[subfunctionName];
  const role = canonicalRoleName(subfunctionName);
  if (/ management$/i.test(role)) return role.replace(/ management$/i, ' Manager');
  if (/ planning$/i.test(role)) return role.replace(/ planning$/i, ' Planner');
  if (/ reporting$/i.test(role)) return role.replace(/ reporting$/i, ' Reporting Specialist');
  if (/ analytics$/i.test(role)) return role.replace(/ analytics$/i, ' Analyst');
  if (/ administration$/i.test(role)) return role.replace(/ administration$/i, ' Administrator');
  return `${role} Specialist`;
}

function lowerFirst(value) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function sentence(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function inferSkills(functionId, roleName, activities) {
  const haystack = `${roleName} ${activities.join(' ')}`;
  const skills = new Set(['Business communication', 'Record and evidence management']);

  for (const [[rule, values], scopes] of skillRules.map((rule, index) => [
    rule,
    skillRuleScopes[index],
  ])) {
    if (!scopes.includes(functionId)) continue;
    if (rule.test(haystack)) values.forEach((value) => skills.add(value));
  }

  return [...skills].slice(0, 8);
}

function inferOutputs(roleName) {
  return [
    `${roleName} plans, decisions and controlled records`,
    'Accurate evidence of completed work and approvals',
    'Performance, exception and corrective-action information',
  ];
}

function accountabilityFromActivity(activity) {
  return sentence(`Own and execute ${lowerFirst(activity)}`);
}

function markdownEscape(value) {
  return String(value).replaceAll('|', '\\|');
}

async function loadTaxonomy() {
  const datasets = await Promise.all(
    shards.map(async (name) => {
      const source = await readFile(path.join(taxonomyDir, name), 'utf8');
      return JSON.parse(source);
    }),
  );

  return datasets.flatMap((dataset) => dataset.functions);
}

function buildFunctionalRoles(functions) {
  return functions.flatMap((fn) =>
    fn.subfunctions.map((subfunction) => {
      const roleName = canonicalRoleName(subfunction.name);
      return {
        id: `FR-${subfunction.id}`,
        status: 'candidate',
        name: roleName,
        purpose: `Own and perform ${subfunction.name.toLowerCase()} work within ${fn.name}, ensuring activities are completed with appropriate evidence, control and measurable outcomes.`,
        jobFamilyId: `JF-${fn.id}`,
        source: {
          functionId: fn.id,
          functionName: fn.name,
          subfunctionId: subfunction.id,
          subfunctionName: subfunction.name,
        },
        activities: [...subfunction.activities],
        accountabilities: subfunction.activities.map(accountabilityFromActivity),
        expectedOutputs: inferOutputs(roleName),
        knowledgeAndSkills: inferSkills(fn.id, roleName, subfunction.activities),
        behaviouralCompetencies: [
          'Ownership and accountability',
          'Structured problem solving',
          'Stakeholder communication',
          'Evidence-based decision making',
          'Continuous improvement',
        ],
        defaultPerformanceMeasures: [
          'Timeliness against agreed service levels or milestones',
          'Quality and accuracy of outputs',
          'Compliance with applicable policy, control and approval requirements',
          'Achievement of role-specific outcome measures',
          'Timely resolution of exceptions and corrective actions',
        ],
      };
    }),
  );
}

function buildJobFamilies(functions) {
  return functions.map((fn) => ({
    id: `JF-${fn.id}`,
    status: 'candidate',
    name: fn.name,
    sourceFunctionId: fn.id,
    purpose: `Group canonical jobs whose primary work sits within ${fn.name}.`,
  }));
}

function buildSpecialistProfile(fn, subfunction) {
  const roleId = `FR-${subfunction.id}`;
  const jobTitle = specialistJobTitle(subfunction.name);
  const roleName = canonicalRoleName(subfunction.name);
  return {
    id: `JP-${subfunction.id}-PROFESSIONAL`,
    status: 'candidate',
    title: jobTitle,
    jobFamilyId: `JF-${fn.id}`,
    level: 'professional',
    purpose: `Perform and continuously improve ${roleName.toLowerCase()} work within ${fn.name}, producing controlled, timely and decision-useful outcomes.`,
    primaryFunctionalRoleIds: [roleId],
    secondaryFunctionalRoleIds: [],
    keyAccountabilities: subfunction.activities.map(accountabilityFromActivity),
    expectedOutputs: inferOutputs(roleName),
    knowledgeAndTechnicalSkills: inferSkills(fn.id, roleName, subfunction.activities),
    behaviouralCompetencies: [
      'Ownership and accountability',
      'Analytical thinking',
      'Stakeholder communication',
      'Attention to quality and control',
      'Continuous improvement',
    ],
    qualifications: [],
    experience: 'Relevant practical experience appropriate to the profession, regulated context and organisational level.',
    performanceMeasures: [
      'Timeliness',
      'Quality / accuracy',
      'Control and policy compliance',
      'Outcome attainment',
      'Exception resolution',
    ],
    alternativeTitles: [],
    sourceMappings: {
      functionIds: [fn.id],
      subfunctionIds: [subfunction.id],
    },
  };
}

function buildFunctionLeadProfile(fn) {
  const roleIds = fn.subfunctions.map((subfunction) => `FR-${subfunction.id}`);
  return {
    id: `JP-${fn.id}-FUNCTION-LEAD`,
    status: 'candidate',
    title: functionLeadTitles[fn.id] ?? `Head of ${fn.name}`,
    jobFamilyId: `JF-${fn.id}`,
    level: 'head',
    purpose: `Provide accountable leadership for ${fn.name}, establishing direction, governance, resources, controls and performance expectations across the function.`,
    primaryFunctionalRoleIds: roleIds,
    secondaryFunctionalRoleIds: [],
    keyAccountabilities: [
      `Set the strategy, operating model and priorities for ${fn.name}.`,
      'Define accountabilities, decision rights, standards and controls for the function.',
      'Prioritise investment, capacity and resources against enterprise objectives and risk.',
      'Review function performance, risks, issues and corrective actions.',
      'Ensure cross-functional dependencies and stakeholder commitments are actively managed.',
      'Sponsor continuous improvement, capability development and appropriate automation.',
    ],
    expectedOutputs: [
      `${fn.name} strategy and operating plan`,
      'Function policies, standards and governance decisions',
      'Resource and investment priorities',
      'Performance, risk and assurance reporting',
      'Improvement and capability roadmap',
    ],
    knowledgeAndTechnicalSkills: inferSkills(
      fn.id,
      fn.name,
      fn.subfunctions.flatMap((subfunction) => subfunction.activities),
    ),
    behaviouralCompetencies: [
      'Enterprise leadership',
      'Strategic judgement',
      'Commercial and risk awareness',
      'Stakeholder leadership',
      'Accountability for outcomes',
      'Organisational development',
    ],
    qualifications: [],
    experience: 'Substantial leadership experience in the relevant professional domain, including accountability for performance, governance and change.',
    performanceMeasures: [
      'Function outcome / KPI attainment',
      'Budget and resource performance',
      'Risk and control effectiveness',
      'Stakeholder outcomes',
      'Improvement and capability maturity',
    ],
    alternativeTitles: [],
    sourceMappings: {
      functionIds: [fn.id],
      subfunctionIds: fn.subfunctions.map((subfunction) => subfunction.id),
    },
  };
}

function buildJobProfiles(functions) {
  const profiles = [];
  for (const fn of functions) {
    profiles.push(buildFunctionLeadProfile(fn));
    for (const subfunction of fn.subfunctions) {
      profiles.push(buildSpecialistProfile(fn, subfunction));
    }
  }
  return profiles;
}

function buildCoverage(functions, functionalRoles, jobProfiles) {
  const sourceSubfunctions = functions.flatMap((fn) => fn.subfunctions);
  const sourceActivities = sourceSubfunctions.flatMap((subfunction) => subfunction.activities);
  const mappedSubfunctions = new Set(
    functionalRoles.map((role) => role.source.subfunctionId),
  );
  const profileMappedSubfunctions = new Set(
    jobProfiles.flatMap((profile) => profile.sourceMappings.subfunctionIds),
  );

  return {
    generatorVersion: 2,
    source: {
      functions: functions.length,
      subfunctions: sourceSubfunctions.length,
      activities: sourceActivities.length,
    },
    generated: {
      jobFamilies: functions.length,
      functionalRoles: functionalRoles.length,
      jobProfiles: jobProfiles.length,
      functionLeadProfiles: functions.length,
      specialistProfiles: sourceSubfunctions.length,
    },
    coverage: {
      functionsCovered: functions.length,
      subfunctionsCoveredByFunctionalRoles: mappedSubfunctions.size,
      subfunctionsCoveredByJobProfiles: profileMappedSubfunctions.size,
      activitiesInheritedByFunctionalRoles: sourceActivities.length,
      allFunctionsCovered: functions.length === 29,
      allSubfunctionsCovered: mappedSubfunctions.size === sourceSubfunctions.length,
    },
  };
}

function validateGeneratedQuality(functions, functionalRoles, jobProfiles, coverage) {
  if (functions.length !== 29) throw new Error(`Expected 29 enterprise functions, found ${functions.length}.`);
  if (functionalRoles.length !== 353) {
    throw new Error(`Expected 353 functional roles, found ${functionalRoles.length}.`);
  }
  if (jobProfiles.length !== 382) {
    throw new Error(`Expected 382 candidate job profiles, found ${jobProfiles.length}.`);
  }
  if (coverage.source.activities !== 1510) {
    throw new Error(`Expected 1,510 source activities, found ${coverage.source.activities}.`);
  }
  if (!coverage.coverage.allFunctionsCovered || !coverage.coverage.allSubfunctionsCovered) {
    throw new Error('Generated job architecture does not fully cover the enterprise taxonomy.');
  }

  const profileById = new Map(jobProfiles.map((profile) => [profile.id, profile]));
  const assertExcludes = (profileId, forbiddenSkills) => {
    const profile = profileById.get(profileId);
    if (!profile) throw new Error(`Missing regression profile ${profileId}.`);
    const leaked = forbiddenSkills.filter((skill) => profile.knowledgeAndTechnicalSkills.includes(skill));
    if (leaked.length > 0) {
      throw new Error(`${profileId} contains cross-function skill leakage: ${leaked.join(', ')}.`);
    }
  };

  assertExcludes('JP-F01.02-PROFESSIONAL', [
    'Human resources',
    'People operations',
    'Customer relationship management',
    'Revenue management',
  ]);
  assertExcludes('JP-F01.05-PROFESSIONAL', [
    'Commercial judgement',
    'Customer relationship management',
    'Revenue management',
    'Quality management',
    'Root-cause analysis',
    'Control assurance',
  ]);
}

function buildMarkdown(functions, roles, profiles) {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const profilesByFamily = new Map();
  for (const profile of profiles) {
    const list = profilesByFamily.get(profile.jobFamilyId) ?? [];
    list.push(profile);
    profilesByFamily.set(profile.jobFamilyId, list);
  }

  const lines = [
    '# Generated Functional Roles & Job Descriptions',
    '',
    '> Generated candidate baseline. Curate before promotion to approved canonical job architecture.',
    '',
  ];

  for (const fn of functions) {
    lines.push(`## ${fn.id} — ${fn.name}`, '');
    const familyProfiles = profilesByFamily.get(`JF-${fn.id}`) ?? [];
    for (const profile of familyProfiles) {
      lines.push(`### ${profile.title}`, '');
      lines.push(`**ID:** \`${profile.id}\`  `);
      lines.push(`**Level:** ${profile.level}  `);
      lines.push(`**Status:** ${profile.status}`, '');
      lines.push(profile.purpose, '');
      lines.push('**Functional roles**', '');
      for (const roleId of profile.primaryFunctionalRoleIds) {
        const role = roleById.get(roleId);
        lines.push(`- ${roleId} — ${role ? markdownEscape(role.name) : roleId}`);
      }
      lines.push('', '**Key accountabilities**', '');
      for (const item of profile.keyAccountabilities) lines.push(`- ${markdownEscape(item)}`);
      lines.push('', '**Expected outputs**', '');
      for (const item of profile.expectedOutputs) lines.push(`- ${markdownEscape(item)}`);
      lines.push('', '**Knowledge and technical skills**', '');
      for (const item of profile.knowledgeAndTechnicalSkills) lines.push(`- ${markdownEscape(item)}`);
      lines.push('', '**Performance measures**', '');
      for (const item of profile.performanceMeasures) lines.push(`- ${markdownEscape(item)}`);
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const functions = await loadTaxonomy();
  const jobFamilies = buildJobFamilies(functions);
  const functionalRoles = buildFunctionalRoles(functions);
  const jobProfiles = buildJobProfiles(functions);
  const coverage = buildCoverage(functions, functionalRoles, jobProfiles);
  validateGeneratedQuality(functions, functionalRoles, jobProfiles, coverage);
  const markdown = buildMarkdown(functions, functionalRoles, jobProfiles);

  await mkdir(outputDir, { recursive: true });

  const artifacts = [
    ['job-families.generated.json', { version: 2, jobFamilies }],
    ['functional-roles.generated.json', { version: 2, functionalRoles }],
    ['job-profiles.generated.json', { version: 2, jobProfiles }],
    ['coverage.generated.json', coverage],
  ];

  for (const [name, value] of artifacts) {
    await writeFile(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  await writeFile(path.join(outputDir, 'job-descriptions.generated.md'), markdown, 'utf8');

  console.log(JSON.stringify(coverage, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
