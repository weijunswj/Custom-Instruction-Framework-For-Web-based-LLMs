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
  ['G4 result and evaluation gate', /After the required G4 result and before accept, merge, close, or next dispatch, Web stages one public-safe evaluation candidate per evaluable run or a durable non-evaluable reason\./i],
  ['intake before terminal governance actions', /Web then queues the valid ledger-intake:v1 before accept, merge, close, or next dispatch\./i],
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

const PAYLOAD_LIMITS = Object.freeze({
  'Custom Instructions': Object.freeze({ unicodeChars: 4500, crlfChars: 4650 }),
  'More about you': Object.freeze({ unicodeChars: 1200, crlfChars: 1300 }),
});

const KERNEL_INVARIANTS = Object.freeze([
  ['accuracy and verification precedence', /Accuracy and verification come before/],
  ['current-information lookup', /Look up current information when facts may have changed/],
  ['source verification and uncertainty', /Verify sources and distinguish[\s\S]*?state uncertainty/],
  ['secret names and redacted values', /secret names only[\s\S]*?\[REDACTED\]/i],
  ['secret classification', /confirmed[\s\S]*?possible[\s\S]*?none/],
  ['secret propagation', /Propagate this protocol to every executor and reviewer/],
  ['fast mode prohibition', /Fast mode prohibited/],
  ['G1 through G4 sequence', /G1 -> G2 -> G3 -> G4/],
  ['Web-only architecture', /Web-only architecture/],
  ['Design Lock authority', /Design Lock/],
  ['model assignment authority', /Never infer, select, or substitute models/],
  ['exact admission authority', /Exact repository, branch, base, head, tree, blob, scope, and clean-checkout admission/],
  ['relevant head invalidation', /relevant head movement invalidates Codex, G4, and independent Web verification/],
  ['missing checks are not green', /Missing checks, statuses, runs, and workflows are not green/],
  ['executor and reviewer boundaries', /reviewers remain read-only[\s\S]*?Executors never self-grade or self-finalise/],
  ['blocking material findings', /Material findings remain blocking/],
  ['guarded governance writes', /Guarded governance writes/],
  ['Web-only review-thread actions', /Web-only review-thread actions/],
  ['verified merge mechanics', /Expected-head squash merge[\s\S]*?canonical-main readback[\s\S]*?branch deletion only after verified merge/],
  ['evaluation and Ledger gate', /Pre-closure requires an evaluation disposition and serialised Ledger intake/],
  ['fail-closed governed work', /Fail closed for governed repository actions/],
  ['current-chat precedence', /Current-chat explicit Web instructions override defaults/],
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
  if (fences.length !== 2) errors.push(`expected exactly two balanced payload fences, found ${fences.length}`);

  const payloads = {};
  for (let i = 0; i < headingIndexes.length; i += 1) {
    const heading = headingIndexes[i];
    const sectionEnd = headingIndexes[i + 1]?.index ?? lines.length;
    const sectionFences = fences.filter(({ open, close }) => open > heading.index && close < sectionEnd);
    if (sectionFences.length !== 1) {
      errors.push(`${heading.name}: expected exactly one payload fence, found ${sectionFences.length}`);
      continue;
    }
    const [fence] = sectionFences;
    const marker = heading.name === 'Custom Instructions' ? 'custom-instructions' : 'more-about-you';
    const openMarker = `<!-- payload:${marker} -->`;
    const closeMarker = `<!-- /payload:${marker} -->`;
    const section = lines.slice(heading.index + 1, sectionEnd);
    const openMarkerCount = section.filter((line) => line === openMarker).length;
    const closeMarkerCount = section.filter((line) => line === closeMarker).length;
    if (openMarkerCount !== 1 || closeMarkerCount !== 1) {
      errors.push(`${heading.name}: payload markers must appear exactly once`);
    }
    if (lines[fence.open - 1] !== openMarker || lines[fence.close + 1] !== closeMarker) {
      errors.push(`${heading.name}: payload markers must directly surround its fence`);
    }
    payloads[heading.name] = lines.slice(fence.open + 1, fence.close).join('\n');
  }

  return { source, payloads, errors };
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

  const rows = [...source.matchAll(/^\| (Custom Instructions|More about you) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| ([0-9a-f]{64}) \|$/gm)];
  if (rows.length !== 2) {
    errors.push(`expected exactly two documented measurement rows, found ${rows.length}`);
    return;
  }
  const documented = {};
  for (const [, name, unicodeChars, lfChars, crlfChars, utf8Bytes, sha256] of rows) {
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

function checkKernelInvariants(payloads, errors) {
  const kernel = Object.values(payloads).join('\n');
  for (const [label, pattern] of KERNEL_INVARIANTS) {
    if (!pattern.test(kernel)) errors.push(`missing global-kernel invariant: ${label}`);
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
  const parsed = parsePayloads(customText);
  errors.push(...parsed.errors);
  checkPayloadLimits(parsed.payloads, errors);
  if (Object.keys(parsed.payloads).length === 2) {
    checkDocumentedMeasurements(customText, parsed.payloads, errors);
    checkKernelInvariants(parsed.payloads, errors);
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
  PROTOCOL_FILE,
  KERNEL_INVARIANTS,
  MAPPING_LABELS,
  PAYLOAD_LIMITS,
  PROTOCOL_CATEGORIES,
  REQUIRED_LEDGER_ORDERING,
  TASK_SPECIFIC_AUTHORITY_PATTERNS,
  checkPayloadLimits,
  checkLedgerOrdering,
  checkReusableAuthority,
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
