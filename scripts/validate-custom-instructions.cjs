'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const CUSTOM_FILE = 'CUSTOM_INSTRUCTIONS.md';
const PROTOCOL_FILE = 'GOVERNED_REPOSITORY_PROTOCOL.md';
const FOCUSED_FILES = Object.freeze([
  CUSTOM_FILE,
  PROTOCOL_FILE,
  'scripts/validate-custom-instructions.cjs',
  'tests/capacity-validation.test.cjs',
  'tests/fixtures/former-more-about-you-payload.txt',
]);
const LEGACY_FIXTURE_FILE = 'tests/fixtures/former-more-about-you-payload.txt';

const TASK_SPECIFIC_AUTHORITY_PATTERNS = Object.freeze([
  ['CI-047 identifier', /\bCI-047\b/i],
  ['repository slug', /weijunswj\/Custom-Instruction-Framework-For-Web-based-LLMs/],
  ['implementation branch', /luna\/ci-047-capacity-kernel-modularisation/],
  ['concrete lowercase 40-hex Git object', /\b[a-f0-9]{40}\b/],
]);

const REQUIRED_LEDGER_ORDERING = Object.freeze([
  ['prior Ledger-intake PR constraint', /Any earlier Ledger-intake PR must already be merged\./i],
  ['single unmerged Ledger-intake PR constraint', /At most one Ledger-intake PR may remain unmerged\./i],
  ['current source PR is not a prerequisite', /The current source PR does not have to merge before its intake is queued\./i],
  ['source versus Ledger-intake distinction', /This is a prior Ledger-intake PR constraint, not a prior source PR constraint\./i],
  ['queued is not appended', /Queued is not appended\./i],
  ['processor receipt proves append', /processor-authored ledger-recorded:v1 receipt proves that the processor appended the record/i],
]);

const FORBIDDEN_LEDGER_ORDERING = Object.freeze([
  ['obsolete source-PR merge gate', /Queue it only after the prior source PR is merged/i],
  ['current source PR merge prerequisite', /current source PR (?:must|has to) merge before (?:its )?intake/i],
]);

const SOURCE_CONTRACT_INVARIANTS = Object.freeze([
  ['current-information lookup', /Look up current information when facts may have changed|Search for the latest information whenever the topic may have changed/i],
  ['facts-versus-assumptions distinction', /Verify sources and distinguish facts, assumptions, inferences, opinions, and recommendations|Separate facts, assumptions, inferences, opinions, and recommendations/i],
  ['explicit uncertainty', /state uncertainty and unresolved conflicts|Explain nuance, uncertainty, and source conflicts/i],
  ['no invented precision', /Never invent precision|never invent precision/i],
  ['inline citations', /Cite sources inline beside (?:claims|the claims)/i],
  ['source-tier preference', /Prefer official or primary sources, followed by expert and reputable secondary sources|Prefer: Official\/primary > expert > reputable secondary/i],
  ['opened-source-only citation', /Never cite a source that was not opened and checked|Do not cite sources not opened and checked/i],
  ['user-link inspection', /When the user supplies a link, open and inspect it before answering|When I provide a link, open and inspect it before answering/i],
  ['snippet-only avoidance', /Do not rely only on snippets, titles, cached descriptions, summaries, search-result text, or memory for a supplied link|do not rely on snippets, titles, summaries, cached descriptions or prior knowledge/i],
  ['practical cross-checking', /Cross-check material claims with at least two independent reliable sources where practical|Cross-check material claims with 2\+ independent reliable sources where possible/i],
  ['authoritative primary artefact', /A directly inspected authoritative primary artefact may be sufficient evidence for its own contents, while important external implications still require separate verification|A directly inspected authoritative primary artefact may suffice for its own contents; verify important external implications separately/i],
  ['access-failure disclosure', /State exactly when source, page or tool access failed and what therefore could not be verified|If source or tool access fails, state exactly what could not be verified/i],
  ['explicit material inferences', /Clearly identify material inferences as inferences and state their reasoning, assumptions and supporting evidence|Wrap any material unverified claim in (?:\x60)?\[INFERENCE START\](?:\x60)?[\s\S]*?reasoning, assumptions, and supporting source/i],
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
  ['G4-only staging prerequisite (After G4 PASS)', /After G4 PASS/i],
  ['G4-only staging prerequisite (After the required G4 result)', /After the required G4 result/i],
  ['G4-only staging prerequisite', /(?:only|solely) after G4(?: PASS| result)/i],
]);

const TOP_FIELD_IDENTITIES = Object.freeze({
  separatorLf: 1,
  sourceBlocks: Object.freeze([
    Object.freeze({ unicodeChars: 2254, lfChars: 2254, crlfChars: 2279, utf8Bytes: 2254, sha256: 'd7a33366ebbcf85bbe7875c209185e3416371b6afbc28c9f5e1582ff8821aded' }),
    Object.freeze({ unicodeChars: 2703, lfChars: 2703, crlfChars: 2708, utf8Bytes: 2727, sha256: '8063c6b8feb5d3e6d7b10b0a68f87f59b76cec529cfedf7bca765415324d9440' }),
  ]),
  combined: Object.freeze({ unicodeChars: 4958, lfChars: 4958, crlfChars: 4989, utf8Bytes: 4982, sha256: 'dd065a6779a5c8d7f4e439a54a8548d4dbb32120f33c2470dab190c364b0f8f5' }),
});

const OWNER_PRESERVATION_RULES = Object.freeze([
  ['saved top field untouched', /Leave the already-saved top field untouched\./i],
  ['documented one-LF assembly', /literal contents of the two immutable Custom Instructions source blocks[\s\S]*joined with exactly one LF using the original documented copy method\./i],
  ['More about you only for UAT', /paste and save only the replacement More about you payload\./i],
  ['mandatory detailed protocol', /GOVERNED_REPOSITORY_PROTOCOL\.md remains the mandatory readable detailed module/i],
]);

const PAYLOAD_LIMITS = Object.freeze({
  'More about you': Object.freeze({ unicodeChars: 1200, crlfChars: 1300 }),
});

const KERNEL_INVARIANTS = Object.freeze([
  ['accuracy and verification precedence', /PRIORITY: Accuracy > Insight > Brevity > Entertainment|Accuracy and verification come before/],
  ['current-information lookup', /Look up current information when facts may have changed|Search for the latest information whenever the topic may have changed/],
  ['secret names and redacted values', /Secret:names only;values \[REDACTED\]|secret names only[\s\S]*?\[REDACTED\]/i],
  ['secret classification', /confirmed=credential[\s\S]*?possible=[\s\S]*?none=|confirmed[\s\S]*?possible[\s\S]*?none/],
  ['secret propagation', /send protocol to every executor\/reviewer|Propagate this protocol to every executor and reviewer/i],
  ['fast mode prohibition', /Fast prohibited|Fast mode prohibited/],
  ['G1 through G4 sequence', /G1(?:\u2192| ->)G2(?:\u2192| ->)G3(?:\u2192| ->)G4/],
  ['Web-only architecture', /Web=sole:arch|Web-only architecture/],
  ['Design Lock authority', /Design Lock|\bDL\b/],
  ['model assignment authority', /Never infer, select, or substitute models|Never infer, self-select, substitute|agents never self-select\/substitute/],
  ['exact admission authority', /exact repo\/branch\/base\/head\/tree\/blob\/scope\+clean-checkout admission|Exact repository, branch, base, head, tree, blob, scope, and clean-checkout admission/],
  ['relevant head invalidation', /head movement invalidates(?: exact-head)?(?: validation\/green evidence)?/],
  ['missing checks are not green', /absent status\/check\/run\/workflow\u2260green|Missing checks, statuses, runs, and workflows are not green/],
  ['executor and reviewer boundaries', /reviewers never edit\/self-finalise|reviewers remain read-only[\s\S]*?Executors never self-grade/],
  ['blocking material findings', /finding\u2192tests\u2192green validation|findings\u2192tests\u2192green validation|Material findings remain blocking/],
  ['guarded governance writes', /Governance writes=guarded|Guarded governance writes/],
  ['Web-only review-thread actions', /Controller-only thread actions|Web-only review-thread actions/],
  ['verified merge mechanics', /Safe final merge execution|expected-head squash merge[\s\S]*?canonical-main readback/i],
  ['evaluation and Ledger gate', /Before accept\/merge\/close\/next|before accept, merge, close, or dispatching the next run or task|Pre-closure requires an evaluation disposition and serialised Ledger intake/i],
  ['fail-closed governed work', /fail closed/],
  ['current-chat precedence', /latest applicable explicit Web instruction|Current-chat explicit Web instructions override defaults/],
]);

const PROTOCOL_CATEGORIES = Object.freeze([
  ['secret classification and propagation', ['## Secret protocol', 'SECRET_EXPOSURE_DETECTED', 'every executor and reviewer']],
  ['G1/G2/G3/G4 role boundaries', ['## Roles and phase sequence', 'G1', 'G2', 'G3', 'G4']],
  ['model-assignment precedence', ['## Model assignment', 'never infer', 'never substitute']],
  ['Git authority and admission packets', ['## Git authority and admission', 'admission packet', 'round-trip']],
  ['relevant versus unrelated governance movement', ['## Governance movement', 'relevant movement', 'unrelated movement']],
  ['waiting and active-delegate continuation', ['## Waiting and continuation', 'active delegate', 'terminal waiting']],
  ['no fabricated persistence or duplicate workers', ['no fabricated persistence', 'no polling', 'duplicate workers']],
  ['ready-triggered Codex watermark states', ['## Readiness and Codex watermark', 'clean +1', 'ambiguous', 'late result']],
  ['guarded child/PR/parent/chronology reconciliation', ['## Reconciliation and closure', 'one parent entry', 'chronology']],
  ['latest-five PR context inspection', ['latest five relevant PRs']],
  ['expected-head squash merge and readback', ['expected-head squash merge', 'canonical-main readback']],
  ['evaluation candidate timing and public-safe fields', ['## Evaluation candidates', 'public-safe', 'before closure']],
  ['Ledger intake schema and serialization', ['## Ledger intake and receipts', 'serialise', 'single-unmerged-intake']],
  ['processor-authored receipt proof', ['processor-authored receipt', 'fake append']],
  ['state-gated response prefixes', ['queued —', 'appended —', 'only after the corresponding state exists']],
  ['truthful dismissal grounds and evidence', ['## Review threads and findings', 'incorrect premise', 'evidence']],
  ['G4 unresolved replies and durable findings', ['unresolved-thread reply', 'durable finding']],
  ['anchorless G4 finding format', ['g4-anchorless:v1', 'anchorless']],
  ['dependency classifications and blocking', ['## Dependencies', 'required', 'optional', 'complete + verified']],
  ['controller-only thread resolution', ['controller-only', 'resolution and dismissal']],
  ['hosted-check absence is not green', ['hosted-check absence', 'not green']],
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
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function decodeUtf8(buffer, label) {
  const errors = [];
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    errors.push(`${label}: UTF-8 BOM is not allowed`);
  }
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    errors.push(`${label}: invalid UTF-8 (${error.message})`);
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
  const headingIndexes = [];

  lines.forEach((line, index) => {
    const match = /^## (Custom Instructions|More about you)$/.exec(line);
    if (match) headingIndexes.push({ name: match[1], index });
  });

  if (headingIndexes.length !== 2) {
    errors.push(`expected exactly two UI payload headings, found ${headingIndexes.length}`);
  }
  if (headingIndexes.map(({ name }) => name).join('|') !== 'Custom Instructions|More about you') {
    errors.push('UI payload headings must appear exactly once in the required order');
  }

  const fences = [];
  let openFence = null;
  lines.forEach((line, index) => {
    if (!line.startsWith('```')) return;
    if (line === '```text') {
      if (openFence) errors.push(`nested Markdown fence at line ${index + 1}`);
      else openFence = { index, kind: 'open' };
      return;
    }
    if (line === '```') {
      if (!openFence) errors.push(`unmatched Markdown closing fence at line ${index + 1}`);
      else {
        fences.push({ open: openFence.index, close: index });
        openFence = null;
      }
      return;
    }
    errors.push(`unsupported or ambiguous Markdown fence at line ${index + 1}`);
  });
  if (openFence) errors.push(`unclosed Markdown fence at line ${openFence.index + 1}`);
  if (fences.length !== 3) errors.push(`expected exactly three balanced payload fences, found ${fences.length}`);

  const payloads = {};
  let sourceBlocks = [];
  const customHeading = headingIndexes.find(({ name }) => name === 'Custom Instructions');
  const moreHeading = headingIndexes.find(({ name }) => name === 'More about you');
  const customEnd = moreHeading?.index ?? lines.length;
  const customFences = customHeading
    ? fences.filter(({ open, close }) => open > customHeading.index && close < customEnd)
    : [];
  const moreFences = moreHeading
    ? fences.filter(({ open }) => open > moreHeading.index)
    : [];

  if (customFences.length !== 2) {
    errors.push(`Custom Instructions: expected exactly two immutable source fences, found ${customFences.length}`);
  } else {
    sourceBlocks = customFences.map(({ open, close }) => lines.slice(open + 1, close).join('\n'));
    for (let index = 0; index < customFences.length; index += 1) {
      const fence = customFences[index];
      const marker = `<!-- immutable-source-block:${index + 1} -->`;
      const closeMarker = `<!-- /immutable-source-block:${index + 1} -->`;
      const section = lines.slice(customHeading.index + 1, customEnd);
      if (section.filter((line) => line === marker).length !== 1 || section.filter((line) => line === closeMarker).length !== 1) {
        errors.push(`Custom Instructions source block ${index + 1}: markers must appear exactly once`);
      }
      if (lines[fence.open - 1] !== marker || lines[fence.close + 1] !== closeMarker) {
        errors.push(`Custom Instructions source block ${index + 1}: markers must directly surround its fence`);
      }
    }
    payloads['Custom Instructions'] = sourceBlocks.join('\n'.repeat(TOP_FIELD_IDENTITIES.separatorLf));
  }

  if (moreFences.length !== 1) {
    errors.push(`More about you: expected exactly one replacement payload fence, found ${moreFences.length}`);
  } else {
    const [fence] = moreFences;
    const openMarker = '<!-- payload:more-about-you -->';
    const closeMarker = '<!-- /payload:more-about-you -->';
    const section = lines.slice(moreHeading.index + 1);
    if (section.filter((line) => line === openMarker).length !== 1 || section.filter((line) => line === closeMarker).length !== 1) {
      errors.push('More about you: payload markers must appear exactly once');
    }
    if (lines[fence.open - 1] !== openMarker || lines[fence.close + 1] !== closeMarker) {
      errors.push('More about you: payload markers must directly surround its fence');
    }
    payloads['More about you'] = lines.slice(fence.open + 1, fence.close).join('\n');
  }

  return { source, payloads, sourceBlocks, errors };
}

function extractPayloads(customText) {
  const result = parsePayloads(customText);
  if (result.errors.length) throw new Error(result.errors.join('; '));
  return result.payloads;
}

function checkDocumentedMeasurements(customText, payloads, errors) {
  const source = normalizeLf(customText);
  const header = '| Payload | Unicode chars | LF chars | CRLF chars | UTF-8 bytes | SHA-256 |';
  if (!source.includes('Payload measurements (payload text only; headings and fences excluded):')) {
    errors.push('payload measurement documentation heading is missing');
  }
  if (!source.includes(header)) errors.push('payload measurement table header is missing or changed');

  const rows = [...source.matchAll(/^\| (Custom Instructions \(combined logical field\)|More about you) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| ([0-9a-f]{64}) \|$/gm)];
  if (rows.length !== 2) {
    errors.push(`expected exactly two documented measurement rows, found ${rows.length}`);
    return;
  }
  const documented = {};
  for (const [, documentedName, unicodeChars, lfChars, crlfChars, utf8Bytes, sha256] of rows) {
    const name = documentedName === 'Custom Instructions (combined logical field)' ? 'Custom Instructions' : documentedName;
    if (documented[name]) errors.push(`duplicate documented measurement row for ${name}`);
    documented[name] = {
      unicodeChars: Number(unicodeChars),
      lfChars: Number(lfChars),
      crlfChars: Number(crlfChars),
      utf8Bytes: Number(utf8Bytes),
      sha256,
    };
  }
  for (const name of Object.keys(PAYLOAD_LIMITS)) {
    if (!payloads[name] || !documented[name]) {
      errors.push(`missing payload or documented measurement for ${name}`);
      continue;
    }
    const actual = measurePayload(payloads[name]);
    for (const field of Object.keys(actual)) {
      if (documented[name][field] !== actual[field]) {
        errors.push(`${name}: documented ${field} ${documented[name][field]} does not match ${actual[field]}`);
      }
    }
  }
}

function checkPayloadLimits(payloads, errors) {
  for (const [name, limits] of Object.entries(PAYLOAD_LIMITS)) {
    if (typeof payloads[name] !== 'string') continue;
    const measurement = measurePayload(payloads[name]);
    if (measurement.unicodeChars > limits.unicodeChars) {
      errors.push(`${name}: Unicode character limit exceeded (${measurement.unicodeChars} > ${limits.unicodeChars})`);
    }
    if (measurement.crlfChars > limits.crlfChars) {
      errors.push(`${name}: CRLF character limit exceeded (${measurement.crlfChars} > ${limits.crlfChars})`);
    }
  }
}

function checkKernelInvariants(payloads, protocolText, errors) {
  const kernel = Object.values(payloads).join('\n') + '\n' + protocolText;
  for (const [label, pattern] of KERNEL_INVARIANTS) {
    if (!pattern.test(kernel)) errors.push(`missing global-kernel invariant: ${label}`);
  }
}

function checkTopFieldIdentity(sourceBlocks, topPayload, errors) {
  if (!Array.isArray(sourceBlocks) || sourceBlocks.length !== TOP_FIELD_IDENTITIES.sourceBlocks.length || typeof topPayload !== 'string') {
    errors.push('top-field identity mismatch: expected exactly two canonical source blocks');
    return;
  }
  sourceBlocks.forEach((block, index) => {
    const actual = measurePayload(block);
    const expected = TOP_FIELD_IDENTITIES.sourceBlocks[index];
    for (const field of Object.keys(expected)) {
      if (actual[field] !== expected[field]) {
        errors.push(`top-field identity mismatch: source block ${index + 1} ${field} ${actual[field]} does not match ${expected[field]}`);
      }
    }
  });
  const combined = measurePayload(topPayload);
  for (const field of Object.keys(TOP_FIELD_IDENTITIES.combined)) {
    if (combined[field] !== TOP_FIELD_IDENTITIES.combined[field]) {
      errors.push(`top-field identity mismatch: combined ${field} ${combined[field]} does not match ${TOP_FIELD_IDENTITIES.combined[field]}`);
    }
  }
}

function checkOwnerPreservation(customText, errors) {
  for (const [label, pattern] of OWNER_PRESERVATION_RULES) {
    if (!pattern.test(customText)) errors.push('missing owner-preservation instruction: ' + label);
  }
}

function checkMoreAboutYouPointer(morePayload, errors) {
  if (!/For governed repository work, require the current authoritative handoff and applicable GOVERNED_REPOSITORY_PROTOCOL\.md in context; fail closed rather than inventing missing authority\./i.test(morePayload)) {
    errors.push('missing More about you governed-work fail-closed pointer');
  }
}

function checkSourceContract(customPayload, errors) {
  for (const [label, pattern] of SOURCE_CONTRACT_INVARIANTS) {
    if (!pattern.test(customPayload)) errors.push('missing source-verification contract: ' + label);
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
  const end = start >= 0 ? protocol.indexOf('## Review threads and findings', start) : -1;
  const staging = start >= 0 ? protocol.slice(start, end >= 0 ? end : protocol.length) : '';
  if (start < 0) errors.push('missing per-run evaluation/Ledger staging: Evaluation candidates section');
  for (const [label, pattern] of FORBIDDEN_STAGING_PREREQUISITES) {
    if (pattern.test(staging)) errors.push('forbidden per-run evaluation/Ledger staging: forbidden ' + label);
  }
  for (const [label, pattern] of PER_RUN_STAGING_RULES) {
    if (!pattern.test(staging)) errors.push('missing per-run evaluation/Ledger staging: ' + label);
  }
  if (!protocol.includes('Final acceptance still requires a fresh exact-head G4 PASS.')) {
    errors.push('missing per-run evaluation/Ledger staging: finality still requires fresh exact-head G4 PASS');
  }
}

function checkProtocol(protocolText, errors) {
  const protocol = normalizeLf(protocolText);
  for (const [label, needles] of PROTOCOL_CATEGORIES) {
    if (!needles.every((needle) => protocol.toLowerCase().includes(needle.toLowerCase()))) {
      errors.push(`missing detailed-protocol semantic category: ${label}`);
    }
  }
  if (!protocol.includes('## Semantic mapping')) errors.push('semantic mapping section is missing');
  for (const label of MAPPING_LABELS) {
    if (!protocol.includes(`| ${label} |`)) errors.push(`semantic mapping row is missing: ${label}`);
  }
  checkLedgerOrdering(protocol, errors);
  checkPerRunStaging(protocol, errors);
}

function checkTextHygiene(text, label, errors) {
  if (!text.endsWith('\n')) errors.push(`${label}: terminal LF is required`);
  const lines = normalizeLf(text).split('\n');
  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) errors.push(`${label}: trailing whitespace on line ${index + 1}`);
  });
}

function validateText(customText, protocolText) {
  const errors = [];
  checkTextHygiene(customText, CUSTOM_FILE, errors);
  checkTextHygiene(protocolText, PROTOCOL_FILE, errors);
  checkReusableAuthority(customText, protocolText, errors);
  checkOwnerPreservation(customText, errors);
  const parsed = parsePayloads(customText);
  errors.push(...parsed.errors);
  checkPayloadLimits(parsed.payloads, errors);
  checkTopFieldIdentity(parsed.sourceBlocks, parsed.payloads['Custom Instructions'], errors);
  if (Object.keys(parsed.payloads).length === 2) {
    checkDocumentedMeasurements(customText, parsed.payloads, errors);
    checkKernelInvariants(parsed.payloads, protocolText, errors);
    checkSourceContract(parsed.payloads['Custom Instructions'], errors);
    checkMoreAboutYouPointer(parsed.payloads['More about you'], errors);
  }
  checkProtocol(protocolText, errors);
  return {
    ok: errors.length === 0,
    errors,
    payloads: parsed.payloads,
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
  const customPath = path.join(root, CUSTOM_FILE);
  const protocolPath = path.join(root, PROTOCOL_FILE);
  const errors = [];
  let customBuffer;
  let protocolBuffer;
  try {
    customBuffer = fs.readFileSync(customPath);
  } catch (error) {
    errors.push(`${CUSTOM_FILE}: ${error.message}`);
    customBuffer = Buffer.alloc(0);
  }
  try {
    protocolBuffer = fs.readFileSync(protocolPath);
  } catch (error) {
    errors.push(`${PROTOCOL_FILE}: ${error.message}`);
    protocolBuffer = Buffer.alloc(0);
  }
  const report = validateBuffers(customBuffer, protocolBuffer);
  report.errors.unshift(...errors);
  for (const relativePath of FOCUSED_FILES.slice(2)) {
    const filePath = path.join(root, relativePath);
    try {
      const decoded = decodeUtf8(fs.readFileSync(filePath), relativePath);
      report.errors.push(...decoded.errors);
      if (!decoded.errors.length) checkTextHygiene(decoded.text, relativePath, report.errors);
    } catch (error) {
      report.errors.push(relativePath + ': ' + error.message);
    }
  }
  report.ok = report.errors.length === 0;
  return report;
}

function formatMeasurement(name, measurement) {
  return `${name}: Unicode=${measurement.unicodeChars}; LF=${measurement.lfChars}; CRLF=${measurement.crlfChars}; UTF-8=${measurement.utf8Bytes}; SHA-256=${measurement.sha256}`;
}

if (require.main === module) {
  const report = validateFiles();
  if (!report.ok) {
    console.error('FAIL: deterministic custom-instructions validation');
    report.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log('PASS: deterministic custom-instructions validation');
    for (const [name, measurement] of Object.entries(report.measurements)) {
      console.log(formatMeasurement(name, measurement));
    }
  }
}

module.exports = {
  CUSTOM_FILE,
  FOCUSED_FILES,
  FORBIDDEN_LEDGER_ORDERING,
  LEGACY_FIXTURE_FILE,
  OWNER_PRESERVATION_RULES,
  PROTOCOL_FILE,
  KERNEL_INVARIANTS,
  MAPPING_LABELS,
  PAYLOAD_LIMITS,
  PER_RUN_STAGING_RULES,
  PROTOCOL_CATEGORIES,
  REQUIRED_LEDGER_ORDERING,
  SOURCE_CONTRACT_INVARIANTS,
  TASK_SPECIFIC_AUTHORITY_PATTERNS,
  TOP_FIELD_IDENTITIES,
  checkPayloadLimits,
  checkLedgerOrdering,
  checkPerRunStaging,
  checkMoreAboutYouPointer,
  checkOwnerPreservation,
  checkReusableAuthority,
  checkSourceContract,
  checkTopFieldIdentity,
  decodeUtf8,
  extractPayloads,
  findTaskSpecificAuthorityViolations,
  formatMeasurement,
  measurePayload,
  normalizeLf,
  parsePayloads,
  validateBuffers,
  validateFiles,
  validateText,
};
