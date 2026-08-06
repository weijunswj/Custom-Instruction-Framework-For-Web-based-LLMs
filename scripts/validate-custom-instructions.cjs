'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const CUSTOM_FILE = 'CUSTOM_INSTRUCTIONS.md';
const PROTOCOL_FILE = 'GOVERNED_REPOSITORY_PROTOCOL.md';
const LEGACY_FIXTURE_FILE = 'tests/fixtures/former-more-about-you-payload.txt';
const FOCUSED_FILES = Object.freeze([
  CUSTOM_FILE,
  PROTOCOL_FILE,
  'scripts/validate-custom-instructions.cjs',
  'tests/capacity-validation.test.cjs',
  LEGACY_FIXTURE_FILE,
]);
const FENCE = String.fromCharCode(96).repeat(3);

const TOP_IMMUTABLE = Object.freeze({
  unicodeChars: 2254,
  lfChars: 2254,
  crlfChars: 2279,
  utf8Bytes: 2254,
  sha256: 'd7a33366ebbcf85bbe7875c209185e3416371b6afbc28c9f5e1582ff8821aded',
});
const TOP_ADDON = Object.freeze({
  unicodeChars: 2289,
  lfChars: 2289,
  crlfChars: 2295,
  utf8Bytes: 2293,
  sha256: '268e3e21abd9fa484dbe7794b877b62e9b5ddb49b8219f3cd95c037d4bbe3ea5',
});
const TOP_COMPLETE = Object.freeze({
  unicodeChars: 4544,
  lfChars: 4544,
  crlfChars: 4576,
  utf8Bytes: 4548,
  sha256: '297e364a14d184045056263bbd64e9fdb9d29afb14f9ae3a7b8d2c13ed1a8c05',
});
const RESPONSE_STYLE = Object.freeze({
  unicodeChars: 248,
  lfChars: 248,
  crlfChars: 252,
  utf8Bytes: 250,
  sha256: '698d93b97c2819d1bdba4782651f65144fb1d0d42c2fb0bb7f930261e8858459',
});
const CLOSURE_ADDON = Object.freeze({
  unicodeChars: 1136,
  lfChars: 1136,
  crlfChars: 1140,
  utf8Bytes: 1138,
  sha256: 'c9a7785dcd73d8b85790c2d9580320782485c2c9674641b51ab3472bdcf44d48',
});
const MORE_COMPLETE = Object.freeze({
  unicodeChars: 1385,
  lfChars: 1385,
  crlfChars: 1394,
  utf8Bytes: 1389,
  sha256: '83490c33a4212076256503f957fbd699f94bf21cfab9ceaf392f489420223799',
});
const LEGACY_FIXTURE_METRICS = Object.freeze({
  unicodeChars: 4961,
  lfChars: 4961,
  crlfChars: 4983,
  utf8Bytes: 4977,
  sha256: '115d4d7a28d54fe42ee33b9386be1c5e846a0200f3393705526e234789bbe4ac',
});
const TOP_FIELD_IDENTITIES = Object.freeze({
  sourceBlocks: Object.freeze([TOP_IMMUTABLE]),
  addOn: TOP_ADDON,
  combined: TOP_COMPLETE,
  separatorLf: 1,
});
const MORE_FIELD_IDENTITIES = Object.freeze({
  sourceBlocks: Object.freeze([RESPONSE_STYLE]),
  addOn: CLOSURE_ADDON,
  combined: MORE_COMPLETE,
  separatorLf: 1,
});
const PAYLOAD_LIMITS = Object.freeze({
  'Custom Instructions add-on': Object.freeze({ crlfChars: 2650 }),
  'Custom Instructions': Object.freeze({ crlfChars: 4931 }),
  'More About You add-on': Object.freeze({ crlfChars: 1150 }),
  'More About You': Object.freeze({ crlfChars: 1404, unicodeChars: 1500 }),
});

const TASK_SPECIFIC_AUTHORITY_PATTERNS = Object.freeze([
  ['CI-047 identifier', /\bCI-047\b/i],
  ['repository slug', /weijunswj\/Custom-Instruction-Framework-For-Web-based-LLMs/i],
  ['implementation branch', /luna\/ci-047-capacity-kernel-modularisation/i],
  ['concrete lowercase 40-hex Git object', /\b[a-f0-9]{40}\b/],
  ['current issue marker', /#(?:30|47|48)\b/],
  ['fixed provider/model route', /\b(?:OpenAI|GPT-5\.6|Luna|Sol-equivalent|Native Sol)\b/i],
]);

const SOURCE_CONTRACT_INVARIANTS = Object.freeze([
  ['current-information lookup', /Search for the latest information whenever the topic may have changed/i],
  ['facts-versus-assumptions distinction', /Separate facts, assumptions, inferences, opinions, and recommendations/i],
  ['explicit uncertainty', /Explain nuance, uncertainty, and source conflicts/i],
  ['no invented precision', /never invent precision, probabilities, ROI, confidence ranges, or estimates/i],
  ['inline citations', /Cite sources inline beside claims/i],
  ['source-tier preference', /Prefer: Official\/primary > expert > reputable secondary\/news > low-trust/i],
  ['opened-source-only citation', /Do not cite sources not opened and checked/i],
  ['user-link inspection', /When I provide a link, open and inspect it before answering/i],
  ['snippet-only avoidance', /do not rely on snippets, titles, summaries, cached descriptions or prior knowledge/i],
  ['practical cross-checking', /Cross-check material claims with 2\+ independent reliable sources where possible/i],
  ['authoritative primary artefact', /A directly inspected authoritative primary artefact may suffice for its own contents; verify important external implications separately/i],
  ['access-failure disclosure', /If source or tool access fails, state exactly what could not be verified/i],
  ['explicit material inferences', /\[INFERENCE START\][\s\S]*reasoning, assumptions, and supporting source/i],
]);

const REQUIRED_LEDGER_ORDERING = Object.freeze([
  ['prior Ledger-intake PR constraint', /Any earlier Ledger-intake PR must already be merged\./i],
  ['single unmerged Ledger-intake PR constraint', /at most one Ledger-intake PR may remain unmerged\./i],
  ['current source PR is not a prerequisite', /The current source PR does not have to merge before its intake is queued\./i],
  ['source versus Ledger-intake distinction', /This is a prior Ledger-intake PR constraint, not a prior source PR constraint\./i],
  ['queued is not appended', /Queued is not appended\./i],
  ['processor receipt proves append', /Only a matching processor-authored ledger-recorded:v1 receipt proves that the processor appended the record\./i],
]);
const FORBIDDEN_LEDGER_ORDERING = Object.freeze([
  ['obsolete source-PR merge gate', /Queue it only after the prior source PR is merged/i],
  ['current source PR merge prerequisite', /current source PR (?:must|has to) merge before (?:its )?intake/i],
]);
const PER_RUN_STAGING_RULES = Object.freeze([
  ['completed substantive-run disposition', /Every terminal completed substantive run is dispositioned individually\./i],
  ['evaluable-run candidate staging', /For every evaluable G3, G4, or other substantive run, Web stages one public-safe evaluation-candidate:v1 before accept, merge, close, or dispatching the next run or task\./i],
  ['non-evaluable reason', /For a non-evaluable run, Web records a durable non-evaluable reason before the same boundary\./i],
  ['G3 AMEND staging before dispatch', /A completed G3 AMEND must be staged before dispatching its next G3 amendment\./i],
  ['G4 candidate timing and non-prerequisite', /A G4 candidate is staged after its result, but G4 is not a prerequisite for staging earlier G3 runs\./i],
  ['Ledger queue before boundary', /After the corresponding evaluation candidate or durable non-evaluable reason exists, Web serialises and queues the valid ledger-intake:v1 before accept, merge, close, or dispatching the next run or task\./i],
]);
const FORBIDDEN_STAGING_PREREQUISITES = Object.freeze([
  ['G4-only staging prerequisite', /(?:only|solely) after G4(?: PASS| result)/i],
]);

const PROTOCOL_CATEGORIES = Object.freeze([
  ['secret classification and propagation', ['## Secret protocol', 'SECRET_EXPOSURE_DETECTED', 'every executor and reviewer']],
  ['G1/G2/G3/G4 role boundaries', ['## Roles and phase sequence', 'G1', 'G2', 'G3', 'G4']],
  ['model-assignment precedence', ['## Model assignment', 'never infer', 'never substitute']],
  ['Git authority and admission packets', ['## Git authority and admission', 'admission packet', 'round-trip']],
  ['relevant versus unrelated governance movement', ['## Governance movement', 'relevant movement', 'unrelated movement']],
  ['waiting and continuation', ['## Waiting and continuation', 'active delegate', 'terminal']],
  ['readiness and Codex watermark', ['## Readiness and Codex watermark', 'ambiguous', 'head movement']],
  ['guarded reconciliation', ['## Reconciliation and closure', 'one parent entry', 'chronology']],
  ['expected-head merge and readback', ['expected-head squash merge', 'canonical-main readback']],
  ['evaluation and Ledger ordering', ['## Evaluation candidates', '## Ledger intake and receipts', 'serialise']],
  ['review findings and truthful actions', ['## Review threads and findings', 'unresolved-thread reply', 'evidence']],
  ['dependencies and hosted absence', ['## Dependencies', 'hosted-check absence', 'not green']],
]);

const MAPPING_LABELS = Object.freeze([
  'Accuracy, current lookup, source verification and uncertainty',
  'Secret classification, redaction and propagation',
  'G1/G2/G3/G4 roles, fast mode and model assignment',
  'Web authority, Design Lock and current-chat precedence',
  'Git admission, exact objects, scope and head invalidation',
  'Waiting, continuation and no fabricated persistence',
  'Readiness, Codex watermark and missing checks',
  'Governance reconciliation and latest PR context',
  'Merge, canonical-main readback and branch deletion',
  'Evaluation candidate and Ledger intake',
  'Review findings, replies, dismissal and controller-only actions',
  'Dependencies and hosted-check absence',
]);

function normalizeLf(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function decodeUtf8(buffer, label) {
  const errors = [];
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    errors.push(label + ': UTF-8 BOM is not allowed');
  }
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    errors.push(label + ': invalid UTF-8 (' + error.message + ')');
  }
  return { text, errors };
}

function measurePayload(payload) {
  const lfPayload = normalizeLf(payload);
  return {
    unicodeChars: Array.from(lfPayload).length,
    lfChars: lfPayload.length,
    crlfChars: lfPayload.replace(/\n/g, '\r\n').length,
    utf8Bytes: Buffer.byteLength(lfPayload, 'utf8'),
    sha256: crypto.createHash('sha256').update(lfPayload, 'utf8').digest('hex'),
  };
}

function parsePayloads(customText) {
  const source = normalizeLf(customText);
  const lines = source.split('\n');
  const errors = [];
  const headings = [];
  lines.forEach((line, index) => {
    const match = /^## (Custom Instructions|More About You)$/.exec(line);
    if (match) headings.push({ name: match[1], index });
  });
  if (headings.length !== 2) errors.push('expected exactly two UI payload headings, found ' + headings.length);
  if (headings.map((item) => item.name).join('|') !== 'Custom Instructions|More About You') {
    errors.push('UI payload headings must appear exactly once in the required order');
  }

  const fences = [];
  let open = null;
  lines.forEach((line, index) => {
    if (!line.startsWith(FENCE)) return;
    if (line === FENCE + 'text') {
      if (open !== null) errors.push('nested Markdown fence at line ' + (index + 1));
      else open = index;
    } else if (line === FENCE) {
      if (open === null) errors.push('unmatched Markdown closing fence at line ' + (index + 1));
      else {
        fences.push({ open, close: index });
        open = null;
      }
    } else {
      errors.push('unsupported or ambiguous Markdown fence at line ' + (index + 1));
    }
  });
  if (open !== null) errors.push('unclosed Markdown fence at line ' + (open + 1));
  if (fences.length !== 4) errors.push('expected exactly four balanced payload fences, found ' + fences.length);

  const customHeading = headings.find((item) => item.name === 'Custom Instructions');
  const moreHeading = headings.find((item) => item.name === 'More About You');
  const customEnd = moreHeading ? moreHeading.index : lines.length;
  const customFences = customHeading ? fences.filter((f) => f.open > customHeading.index && f.close < customEnd) : [];
  const moreFences = moreHeading ? fences.filter((f) => f.open > moreHeading.index) : [];
  const sourceBlocks = [];
  const addOns = [];
  const payloads = {};
  const expectedCustomMarkers = [
    ['immutable-source-block:1', '/immutable-source-block:1'],
    ['mutable-source-block:coding-governance-addon', '/mutable-source-block:coding-governance-addon'],
  ];
  const expectedMoreMarkers = [
    ['immutable-source-block:response-style', '/immutable-source-block:response-style'],
    ['mutable-source-block:governance-closure', '/mutable-source-block:governance-closure'],
  ];

  function readFences(found, expectedMarkers, label) {
    if (found.length !== 2) {
      errors.push(label + ': expected exactly two source fences, found ' + found.length);
      return [];
    }
    return found.map((fence, index) => {
      const body = lines.slice(fence.open + 1, fence.close).join('\n');
      const marker = '<!-- ' + expectedMarkers[index][0] + ' -->';
      const closeMarker = '<!-- ' + expectedMarkers[index][1] + ' -->';
      const sectionStart = label === 'Custom Instructions' ? customHeading.index : moreHeading.index;
      const sectionEnd = label === 'Custom Instructions' ? customEnd : lines.length;
      const section = lines.slice(sectionStart + 1, sectionEnd);
      if (section.filter((line) => line === marker).length !== 1 || section.filter((line) => line === closeMarker).length !== 1) {
        errors.push(label + ' block ' + (index + 1) + ': markers must appear exactly once');
      }
      if (lines[fence.open - 1] !== marker || lines[fence.close + 1] !== closeMarker) {
        errors.push(label + ' block ' + (index + 1) + ': markers must directly surround its fence');
      }
      return body;
    });
  }

  if (customFences.length === 2) {
    const blocks = readFences(customFences, expectedCustomMarkers, 'Custom Instructions');
    sourceBlocks.push(blocks[0]);
    addOns.push(blocks[1]);
    payloads['Custom Instructions'] = blocks[0] + '\n' + blocks[1];
  } else {
    errors.push('Custom Instructions: expected exactly two source fences, found ' + customFences.length);
  }
  if (moreFences.length === 2) {
    const blocks = readFences(moreFences, expectedMoreMarkers, 'More About You');
    sourceBlocks.push(blocks[0]);
    addOns.push(blocks[1]);
    payloads['More About You'] = blocks[0] + '\n' + blocks[1];
  } else {
    errors.push('More About You: expected exactly two source fences, found ' + moreFences.length);
  }
  return { source, payloads, sourceBlocks, addOns, errors };
}

function extractPayloads(customText) {
  const result = parsePayloads(customText);
  if (result.errors.length) throw new Error(result.errors.join('; '));
  return result.payloads;
}

function compareMetrics(actual, expected, label, errors) {
  for (const field of ['unicodeChars', 'lfChars', 'crlfChars', 'utf8Bytes', 'sha256']) {
    if (!actual || actual[field] !== expected[field]) {
      errors.push(label + ' identity mismatch: ' + field + ' ' + (actual ? actual[field] : 'missing') + ' != ' + expected[field]);
    }
  }
}

function checkPayloadIdentities(parsed, errors) {
  if (parsed.sourceBlocks.length !== 2 || parsed.addOns.length !== 2) {
    errors.push('A5 field identity requires exactly two immutable blocks and two mutable add-ons');
    return;
  }
  compareMetrics(measurePayload(parsed.sourceBlocks[0]), TOP_IMMUTABLE, 'immutable top block', errors);
  compareMetrics(measurePayload(parsed.addOns[0]), TOP_ADDON, 'Coding Governance Add-on', errors);
  compareMetrics(measurePayload(parsed.payloads['Custom Instructions']), TOP_COMPLETE, 'complete Custom Instructions field', errors);
  compareMetrics(measurePayload(parsed.sourceBlocks[1]), RESPONSE_STYLE, 'immutable Response Style block', errors);
  compareMetrics(measurePayload(parsed.addOns[1]), CLOSURE_ADDON, 'Governance & Closure add-on', errors);
  compareMetrics(measurePayload(parsed.payloads['More About You']), MORE_COMPLETE, 'complete More About You field', errors);
}

function checkDocumentedMeasurements(customText, payloads, errors) {
  const source = normalizeLf(customText);
  if (!source.includes('Complete-field measurements (payload text only; headings, markers and fences excluded):')) {
    errors.push('complete-field measurement heading is missing');
  }
  if (!source.includes('| Payload | Unicode/LF | CRLF | UTF-8 bytes | SHA-256 |')) {
    errors.push('complete-field measurement table header is missing or changed');
  }
  const rows = [...source.matchAll(/^\| (Immutable Decision\/Verification source|Coding Governance Add-on|Complete Custom Instructions field|Immutable Response Style source|Governance & Closure add-on|Complete More About You field) \| (\d+) \| (\d+) \| (\d+) \| ([0-9a-f]{64}) \|$/gm)];
  if (rows.length !== 6) {
    errors.push('expected exactly six documented measurement rows, found ' + rows.length);
    return;
  }
  const expected = {
    'Immutable Decision/Verification source': TOP_IMMUTABLE,
    'Coding Governance Add-on': TOP_ADDON,
    'Complete Custom Instructions field': TOP_COMPLETE,
    'Immutable Response Style source': RESPONSE_STYLE,
    'Governance & Closure add-on': CLOSURE_ADDON,
    'Complete More About You field': MORE_COMPLETE,
  };
  const seen = new Set();
  for (const row of rows) {
    const name = row[1];
    if (seen.has(name)) errors.push('duplicate documented measurement row for ' + name);
    seen.add(name);
    const actual = expected[name];
    if (!actual) continue;
    const documented = {
      unicodeChars: Number(row[2]),
      lfChars: Number(row[2]),
      crlfChars: Number(row[3]),
      utf8Bytes: Number(row[4]),
      sha256: row[5],
    };
    compareMetrics(documented, actual, 'documented ' + name, errors);
  }
}

function checkPayloadLimits(parsed, errors) {
  const values = [
    ['Custom Instructions add-on', parsed.addOns[0]],
    ['Custom Instructions', parsed.payloads['Custom Instructions']],
    ['More About You add-on', parsed.addOns[1]],
    ['More About You', parsed.payloads['More About You']],
  ];
  for (const [name, payload] of values) {
    if (typeof payload !== 'string') continue;
    const actual = measurePayload(payload);
    const limit = PAYLOAD_LIMITS[name];
    if (actual.crlfChars > limit.crlfChars) {
      errors.push(name + ': CRLF character limit exceeded (' + actual.crlfChars + ' > ' + limit.crlfChars + ')');
    }
    if (limit.unicodeChars && actual.unicodeChars >= limit.unicodeChars) {
      errors.push(name + ': observed product control exceeded (' + actual.unicodeChars + ' >= ' + limit.unicodeChars + ')');
    }
  }
}

function checkCopyInstructions(customText, errors) {
  const required = [
    'Copy the complete top field exactly as assembled below:',
    'immutable Decision/Verification source block followed by exactly one LF',
    'exact Coding Governance Add-on',
    'Copy the complete More About You field exactly as assembled below:',
    'immutable Response Style source block followed by exactly one LF',
    'exact Governance & Closure add-on',
    'Both complete fields must pass owner live-save UAT on the exact committed payloads',
    'not mandatory runtime context',
  ];
  for (const needle of required) {
    if (!customText.includes(needle)) errors.push('missing copy/UAT/runtime instruction: ' + needle);
  }
}

function checkExternalRuntimeDependency(customText, protocolText, errors) {
  const combined = normalizeLf(customText + '\n' + protocolText);
  let safe = combined;
  for (const phrase of ['not mandatory runtime context', 'not a runtime dependency', 'must not depend on loading it']) {
    safe = safe.replace(new RegExp(phrase, 'gi'), '');
  }
  if (/\bmandatory runtime (?:context|dependency)\b/i.test(safe)) {
    errors.push('mandatory external-document runtime dependency is present');
  }
  if (/(?:must|required|mandatory)\b[\s\S]{0,100}\b(?:load|fetch|read)\b[\s\S]{0,100}\b(?:protocol|external document|separate document)\b/i.test(safe)) {
    errors.push('external document is described as a mandatory runtime input');
  }
  if (/compact (?:mandatory|required)-protocol pointer|mandatory task context/i.test(safe)) {
    errors.push('protocol-document pointer is a mandatory runtime dependency');
  }
  if (!/The two live fields are self-contained/i.test(combined)) {
    errors.push('self-contained live-field architecture statement is missing');
  }
}

function findTaskSpecificAuthorityViolations(customText, protocolText) {
  const violations = [];
  for (const [label, text] of [[CUSTOM_FILE, customText], [PROTOCOL_FILE, protocolText]]) {
    for (const [patternLabel, pattern] of TASK_SPECIFIC_AUTHORITY_PATTERNS) {
      if (pattern.test(text)) violations.push(label + ': ' + patternLabel);
    }
  }
  return violations;
}

function checkReusableAuthority(customText, protocolText, errors) {
  for (const violation of findTaskSpecificAuthorityViolations(customText, protocolText)) {
    errors.push('reusable document contains forbidden task-specific authority: ' + violation);
  }
}

function checkSourceContract(topPayload, errors) {
  for (const [label, pattern] of SOURCE_CONTRACT_INVARIANTS) {
    if (!pattern.test(topPayload)) errors.push('source-verification contract: ' + label);
  }
}

function checkLiveSemantics(payloads, errors) {
  const live = Object.values(payloads).join('\n');
  const notEqual = String.fromCharCode(0x2260);
  const required = [
    ['current Web handoff authority', /User\/current Web handoff is sole generic authority/],
    ['no fixed route', /No fixed model or host route/],
    ['root-only grant-bound topology', /Default root-only;.*complete current-run grant/],
    ['topology-neutral outer gates', /G1[\u2013-]G4 are outer governance gates, not a fixed agent chain/],
    ['exact live admission', /Before substantive work admit live exact repo\/branch\/base\/head\/tree\/blobs\/scope, clean workspace/],
    ['live metadata precedence', /Live metadata beats stale body text/],
    ['movement invalidation', /head movement invalidates validation, Codex, G4 and Web verification/],
    ['timeout inconclusive', /Timeout\/missing terminal summary=>inconclusive, never pass/],
    ['hosted absence', new RegExp('Missing status/check/run/workflow=>absent, not green')],
    ['review inventory', /Every Web cycle and before another prompt\/G4\/ready\/merge\/closure\/next task/],
    ['outdated review remains active', new RegExp('Outdated\/closed\/merged' + notEqual + 'cleared')],
    ['actionable finding propagation', /Carry every actionable finding into the next run/],
    ['blocking material finding', /valid unfixed\/unverified material findings stay open and block progression/],
    ['review mutation authority', /Only user\/Web or explicitly authorised review capability may reply\/resolve\/reopen\/dismiss/],
    ['fresh G4 and Web finality', /fresh isolated read-only exact-head review; independent Web verification owns acceptance\/finality/],
    ['rolling parent', /One rolling parent is authority/],
    ['first eligible queue', /top-to-bottom first eligible pickup/],
    ['final audit last', /declared final audit stays last/],
    ['four-surface reconciliation', /PARENT_RECONCILIATION_INCOMPLETE/],
    ['reconciliation progression block', /no prompt, substantive work, G4, ready, merge, closure or next pickup/],
    ['evaluation before boundary', /Before accept\/merge\/close\/next, disposition each terminal substantive run/],
    ['source PR not required', /source PR need not merge first/],
    ['queued not appended', /queued≠appended/],
    ['receipt-only append', /only matching processor receipt proves append/],
    ['required follow-up blocking', /Required unfinished remediation\/follow-up remains linked and blocking/],
    ['expected-head readback', /Expected-head squash by default; verify canonical main commit\/tree\/blobs; delete branch only after readback/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(live)) errors.push('missing permanent live-field invariant: ' + label);
  }
}

function checkLedgerOrdering(protocolText, errors) {
  const protocol = normalizeLf(protocolText);
  for (const [label, pattern] of FORBIDDEN_LEDGER_ORDERING) {
    if (pattern.test(protocol)) errors.push('forbidden Ledger ordering: ' + label);
  }
  for (const [label, pattern] of REQUIRED_LEDGER_ORDERING) {
    if (!pattern.test(protocol)) errors.push('missing Ledger ordering rule: ' + label);
  }
}

function checkPerRunStaging(protocolText, errors) {
  const protocol = normalizeLf(protocolText);
  const start = protocol.indexOf('## Evaluation candidates');
  const end = protocol.indexOf('## Review threads and findings', start);
  const staging = start >= 0 ? protocol.slice(start, end >= 0 ? end : protocol.length) : '';
  if (start < 0) errors.push('missing per-run evaluation/Ledger staging: Evaluation candidates section');
  for (const [label, pattern] of FORBIDDEN_STAGING_PREREQUISITES) {
    if (pattern.test(staging)) errors.push('forbidden per-run evaluation/Ledger staging: ' + label);
  }
  for (const [label, pattern] of PER_RUN_STAGING_RULES) {
    if (!pattern.test(staging)) errors.push('missing per-run evaluation/Ledger staging: ' + label);
  }
  if (!protocol.includes('Final acceptance still requires a fresh exact-head G4 PASS.')) {
    errors.push('missing final fresh exact-head G4 gate');
  }
}

function checkProtocol(protocolText, errors) {
  const protocol = normalizeLf(protocolText);
  for (const [label, needles] of PROTOCOL_CATEGORIES) {
    if (!needles.every((needle) => protocol.toLowerCase().includes(needle.toLowerCase()))) {
      errors.push('missing detailed-protocol semantic category: ' + label);
    }
  }
  if (!protocol.includes('## Semantic mapping')) errors.push('semantic mapping section is missing');
  for (const label of MAPPING_LABELS) {
    if (!protocol.includes('| ' + label + ' |')) errors.push('semantic mapping row is missing: ' + label);
  }
  if (!/not mandatory runtime context/i.test(protocol) || !/not a runtime dependency/i.test(protocol)) {
    errors.push('protocol maintenance-only runtime statement is missing');
  }
  checkLedgerOrdering(protocol, errors);
  checkPerRunStaging(protocol, errors);
}

function checkTextHygiene(text, label, errors) {
  if (!text.endsWith('\n')) errors.push(label + ': terminal LF is required');
  normalizeLf(text).split('\n').forEach((line, index) => {
    if (/[ \t]+$/.test(line)) errors.push(label + ': trailing whitespace on line ' + (index + 1));
  });
}

function checkLegacyFixture(root, errors) {
  const relative = LEGACY_FIXTURE_FILE;
  const filePath = path.join(root, relative);
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (error) {
    errors.push(relative + ': ' + error.message);
    return;
  }
  const decoded = decodeUtf8(buffer, relative);
  errors.push(...decoded.errors);
  if (decoded.errors.length) return;
  checkTextHygiene(decoded.text, relative, errors);
  if (!decoded.text.endsWith('\n') || decoded.text.endsWith('\n\n')) {
    errors.push(relative + ': exactly one terminal LF is required');
    return;
  }
  const normalized = normalizeLf(decoded.text);
  compareMetrics(measurePayload(normalized.slice(0, -1)), LEGACY_FIXTURE_METRICS, 'legacy fixture', errors);
}

function validateText(customText, protocolText) {
  const errors = [];
  checkTextHygiene(customText, CUSTOM_FILE, errors);
  checkTextHygiene(protocolText, PROTOCOL_FILE, errors);
  checkExternalRuntimeDependency(customText, protocolText, errors);
  checkReusableAuthority(customText, protocolText, errors);
  const parsed = parsePayloads(customText);
  errors.push(...parsed.errors);
  checkCopyInstructions(customText, errors);
  if (Object.keys(parsed.payloads).length === 2) {
    checkPayloadIdentities(parsed, errors);
    checkDocumentedMeasurements(customText, parsed.payloads, errors);
    checkPayloadLimits(parsed, errors);
    checkSourceContract(parsed.payloads['Custom Instructions'], errors);
    checkLiveSemantics(parsed.payloads, errors);
  }
  checkProtocol(protocolText, errors);
  return {
    ok: errors.length === 0,
    errors,
    payloads: parsed.payloads,
    sourceBlocks: parsed.sourceBlocks,
    addOns: parsed.addOns,
    measurements: Object.fromEntries(Object.entries(parsed.payloads).map(([name, payload]) => [name, measurePayload(payload)])),
  };
}

function validateBuffers(customBuffer, protocolBuffer) {
  const custom = decodeUtf8(customBuffer, CUSTOM_FILE);
  const protocol = decodeUtf8(protocolBuffer, PROTOCOL_FILE);
  const report = validateText(custom.text, protocol.text);
  report.errors.unshift(...custom.errors, ...protocol.errors);
  report.ok = report.errors.length === 0;
  return report;
}

function validateFiles(root = ROOT) {
  const errors = [];
  let customBuffer = Buffer.alloc(0);
  let protocolBuffer = Buffer.alloc(0);
  try {
    customBuffer = fs.readFileSync(path.join(root, CUSTOM_FILE));
  } catch (error) {
    errors.push(CUSTOM_FILE + ': ' + error.message);
  }
  try {
    protocolBuffer = fs.readFileSync(path.join(root, PROTOCOL_FILE));
  } catch (error) {
    errors.push(PROTOCOL_FILE + ': ' + error.message);
  }
  const report = validateBuffers(customBuffer, protocolBuffer);
  report.errors.unshift(...errors);
  for (const relativePath of FOCUSED_FILES.slice(2, 4)) {
    try {
      const decoded = decodeUtf8(fs.readFileSync(path.join(root, relativePath)), relativePath);
      report.errors.push(...decoded.errors);
      if (!decoded.errors.length) checkTextHygiene(decoded.text, relativePath, report.errors);
    } catch (error) {
      report.errors.push(relativePath + ': ' + error.message);
    }
  }
  checkLegacyFixture(root, report.errors);
  report.ok = report.errors.length === 0;
  return report;
}

function inventoryReview(records) {
  const list = Array.isArray(records) ? records : [];
  const unresolved = list.filter((item) => item && item.isResolved !== true && item.resolved !== true);
  const isThread = (item) => item.kind === 'thread' || item.type === 'thread' || item.isThread === true || item.inline === true;
  const isReviewComment = (item) => item.kind === 'review-comment' || item.type === 'review-comment' || item.reviewComment === true;
  const isSubmittedReview = (item) => item.kind === 'submitted-review' || item.type === 'submitted-review' || item.submittedReview === true;
  const inlineThreads = unresolved.filter(isThread);
  const reviewComments = unresolved.filter(isReviewComment);
  const blockingSubmittedReviews = unresolved.filter((item) => isSubmittedReview(item) && (item.blocking === true || item.state === 'CHANGES_REQUESTED' || item.state === 'BLOCKING'));
  const actionableFindings = unresolved.filter((item) => item.actionable !== false && item.material !== false);
  return {
    allUnresolved: unresolved,
    unresolvedInlineThreads: inlineThreads,
    unresolvedReviewComments: reviewComments,
    blockingSubmittedReviews,
    actionableFindings,
    retainsOutdated: unresolved.some((item) => item.isOutdated === true),
    retainsClosedOrMerged: unresolved.some((item) => item.prState === 'closed' || item.prState === 'merged'),
    blocksProgress: actionableFindings.length > 0 || blockingSubmittedReviews.length > 0,
  };
}

function validateReviewPropagation(inventory, nextPrompt) {
  const current = inventory && inventory.actionableFindings ? inventory : inventoryReview(inventory);
  const prompt = String(nextPrompt || '');
  const missing = current.actionableFindings
    .map((finding) => String(finding.id || finding.threadId || finding.commentId || ''))
    .filter((id) => id && !prompt.includes(id));
  return {
    ok: missing.length === 0,
    missing,
    blocksProgress: missing.length > 0 || current.blocksProgress,
  };
}

function truthfulReviewResolutionAllowed(record) {
  const item = record || {};
  return item.isResolved === true && item.evidenceBacked === true && typeof item.completionEvidence === 'string' && item.completionEvidence.trim().length > 0;
}

function reviewMutationAllowed(input) {
  const data = typeof input === 'string' ? { role: input } : (input || {});
  const role = String(data.role || '').toLowerCase();
  if (role === 'g3' || role === 'executor') return false;
  const actor = String(data.actor || data.owner || '').toLowerCase();
  const capability = String(data.capability || '').toLowerCase();
  return actor === 'user' || actor === 'web' || capability === 'authorised-review-capability' || data.authorised === true;
}

function stableValue(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableValue);
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function sameAuthorityValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function admitLiveAuthority(input) {
  const data = input || {};
  const actual = data.actual || data.live || data;
  const expected = data.expected || {};
  const required = ['repo', 'branch', 'base', 'head', 'tree', 'blobs', 'scope'];
  const errors = [];
  for (const key of required) {
    if (expected[key] === undefined || actual[key] === undefined) errors.push('missing live authority: ' + key);
    else if (!sameAuthorityValue(actual[key], expected[key])) errors.push('live authority mismatch: ' + key);
  }
  return { ok: errors.length === 0, code: errors.length ? 'LIVE_AUTHORITY_INCOMPLETE' : 'LIVE_AUTHORITY_EXACT', errors };
}

function headMovementInvalidates(prior, current) {
  const left = prior || {};
  const right = current || {};
  const keys = ['repo', 'branch', 'base', 'head', 'tree', 'blobs', 'scope'];
  return keys.some((key) => !sameAuthorityValue(left[key], right[key]));
}

function assessTerminalEvidence(input) {
  const data = input || {};
  if (data.timedOut === true || data.terminalSummary === undefined || data.terminalSummary === null || data.terminalSummary === '') {
    return { status: 'INCONCLUSIVE', pass: false, hosted: 'UNKNOWN', reason: 'timeout or missing terminal summary' };
  }
  const hostedFields = ['statuses', 'checks', 'runs', 'workflows'];
  if (hostedFields.some((key) => !Array.isArray(data[key]) || data[key].length === 0)) {
    return { status: 'ABSENT_NOT_GREEN', pass: false, hosted: 'ABSENT_NOT_GREEN', reason: 'hosted evidence absent' };
  }
  if (data.status !== 'PASS') {
    return { status: 'FAIL', pass: false, hosted: 'COMPLETE', reason: 'terminal result is not PASS' };
  }
  return { status: 'PASS', pass: true, hosted: 'COMPLETE' };
}

function selectFirstEligible(entries, predicate) {
  const list = Array.isArray(entries) ? entries : [];
  const eligible = predicate || ((entry) => entry && entry.eligible === true);
  return list.find((entry) => !entry.finalAudit && eligible(entry)) || null;
}

function validateLifecycleQueue(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const errors = [];
  const seen = new Map();
  for (const entry of list) {
    const id = entry && (entry.childId || entry.id);
    if (!id) {
      errors.push('lifecycle entry is missing child identity');
      continue;
    }
    seen.set(id, (seen.get(id) || 0) + 1);
    if (entry.competingQueue === true || entry.queueConflict === true || (Array.isArray(entry.queues) && entry.queues.length > 1)) {
      errors.push('competing queue for ' + id);
    }
  }
  for (const [id, count] of seen) {
    if (count !== 1) errors.push('duplicate lifecycle entry for ' + id);
  }
  const finalIndexes = list.map((entry, index) => entry && entry.finalAudit ? index : -1).filter((index) => index >= 0);
  if (finalIndexes.some((index) => index !== list.length - 1)) errors.push('declared final audit is not last');
  const firstEligible = selectFirstEligible(list);
  return { ok: errors.length === 0, errors, firstEligible };
}

function reconcileFourSurfaces(input) {
  const data = input || {};
  const errors = [];
  const child = data.child;
  const pr = data.pr;
  const parentEntries = Array.isArray(data.parentEntry) ? data.parentEntry : [data.parentEntry];
  const chronology = data.chronology;
  if (!child || !pr || !chronology || parentEntries.length !== 1 || !parentEntries[0]) {
    errors.push('all four reconciliation surfaces are required');
  }
  const parent = parentEntries[0] || {};
  const childId = child && (child.id || child.childId);
  const prId = pr && (pr.number || pr.id);
  const head = child && (child.head || child.headOid);
  if (parent.childId !== undefined && parent.childId !== childId) errors.push('parent child identity mismatch');
  if (parent.prNumber !== undefined && parent.prNumber !== prId) errors.push('parent PR identity mismatch');
  if (parent.head !== undefined && parent.head !== head) errors.push('parent head mismatch');
  if (chronology.childId !== undefined && chronology.childId !== childId) errors.push('chronology child identity mismatch');
  if (chronology.prNumber !== undefined && chronology.prNumber !== prId) errors.push('chronology PR identity mismatch');
  if (chronology.head !== undefined && chronology.head !== head) errors.push('chronology head mismatch');
  return {
    ok: errors.length === 0,
    code: errors.length === 0 ? 'RECONCILED' : 'PARENT_RECONCILIATION_INCOMPLETE',
    errors,
  };
}

function canProgressFromReconciliation(result) {
  return Boolean(result && result.ok && result.code === 'RECONCILED');
}

function ledgerAppendProof(input) {
  const data = input || {};
  const receipt = data.receipt;
  if (!receipt || data.queued !== true) return false;
  const kind = receipt.kind || receipt.type || receipt.marker;
  const processor = receipt.processor === true || receipt.authorRole === 'processor' || receipt.author === 'processor';
  const matching = !data.runId || receipt.runId === data.runId;
  return processor && matching && /ledger-recorded:v1/i.test(String(kind || ''));
}

function stageRunBoundary(input) {
  const data = input || {};
  const dispositioned = Boolean(data.evaluationCandidate || data.nonEvaluableReason);
  const ledgerQueued = data.ledgerQueued === true;
  const appendProven = ledgerAppendProof({ queued: ledgerQueued, receipt: data.ledgerReceipt, runId: data.runId });
  const ok = dispositioned && ledgerQueued;
  return {
    ok,
    blocksNextDispatch: !ok,
    dispositioned,
    ledgerQueued,
    appendProven,
    sourcePrMergeRequired: false,
  };
}

function formatMeasurement(name, measurement) {
  return name + ': Unicode=' + measurement.unicodeChars + '; LF=' + measurement.lfChars + '; CRLF=' + measurement.crlfChars + '; UTF-8=' + measurement.utf8Bytes + '; SHA-256=' + measurement.sha256;
}

if (require.main === module) {
  const report = validateFiles();
  if (!report.ok) {
    console.error('FAIL: deterministic custom-instructions validation');
    report.errors.forEach((error) => console.error('- ' + error));
    process.exitCode = 1;
  } else {
    console.log('PASS: deterministic custom-instructions validation');
    Object.entries(report.measurements).forEach(([name, measurement]) => console.log(formatMeasurement(name, measurement)));
  }
}

module.exports = {
  CUSTOM_FILE,
  FOCUSED_FILES,
  PROTOCOL_FILE,
  LEGACY_FIXTURE_FILE,
  TOP_IMMUTABLE,
  TOP_ADDON,
  TOP_COMPLETE,
  RESPONSE_STYLE,
  CLOSURE_ADDON,
  MORE_COMPLETE,
  LEGACY_FIXTURE_METRICS,
  TOP_FIELD_IDENTITIES,
  MORE_FIELD_IDENTITIES,
  PAYLOAD_LIMITS,
  TASK_SPECIFIC_AUTHORITY_PATTERNS,
  SOURCE_CONTRACT_INVARIANTS,
  REQUIRED_LEDGER_ORDERING,
  FORBIDDEN_LEDGER_ORDERING,
  PER_RUN_STAGING_RULES,
  FORBIDDEN_STAGING_PREREQUISITES,
  PROTOCOL_CATEGORIES,
  MAPPING_LABELS,
  normalizeLf,
  decodeUtf8,
  measurePayload,
  parsePayloads,
  extractPayloads,
  compareMetrics,
  checkPayloadIdentities,
  checkDocumentedMeasurements,
  checkPayloadLimits,
  checkCopyInstructions,
  checkExternalRuntimeDependency,
  findTaskSpecificAuthorityViolations,
  checkReusableAuthority,
  checkSourceContract,
  checkLiveSemantics,
  checkLedgerOrdering,
  checkPerRunStaging,
  checkProtocol,
  checkTextHygiene,
  validateText,
  validateBuffers,
  validateFiles,
  inventoryReview,
  validateReviewPropagation,
  truthfulReviewResolutionAllowed,
  reviewMutationAllowed,
  admitLiveAuthority,
  headMovementInvalidates,
  assessTerminalEvidence,
  selectFirstEligible,
  validateLifecycleQueue,
  reconcileFourSurfaces,
  canProgressFromReconciliation,
  ledgerAppendProof,
  stageRunBoundary,
  formatMeasurement,
};
