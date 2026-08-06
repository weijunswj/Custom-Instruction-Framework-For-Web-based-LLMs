'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  LEGACY_FIXTURE_FILE,
  PAYLOAD_LIMITS,
  checkLedgerOrdering,
  extractPayloads,
  findTaskSpecificAuthorityViolations,
  measurePayload,
  normalizeLf,
  parsePayloads,
  validateBuffers,
  validateFiles,
  validateText,
} = require('../scripts/validate-custom-instructions.cjs');

const root = path.resolve(__dirname, '..');
const customPath = path.join(root, 'CUSTOM_INSTRUCTIONS.md');
const protocolPath = path.join(root, 'GOVERNED_REPOSITORY_PROTOCOL.md');
const testPath = path.join(root, 'tests', 'capacity-validation.test.cjs');
const canonicalCustom = fs.readFileSync(customPath, 'utf8');
const canonicalProtocol = fs.readFileSync(protocolPath, 'utf8');
const currentTest = fs.readFileSync(testPath, 'utf8');

const BASE_COMMIT = 'd1e926f74d51f432de32bc8932501922765eae20';
const AMENDMENT_PARENT = 'd94f91101883b817705a3adbdf116d844db59c79';
const SECOND_AMENDMENT_PARENT = 'c87587429f92ec946287d4ef7eaa40c302f4a5b7';
const A2_AMENDMENT_PARENT = 'fbc69db25777976afaabf3103044a5d3ed74f69b';
const FORMER_SOURCE_BLOB = '23d589c88e51bc3e09a76f269e4a89157e385e7b';
const FORMER_FIXTURE_BLOB = '6fe5b92411f16d1f744f319ea1170060b456d4d3';
const FORMER_PAYLOAD_SHA256 = '115d4d7a28d54fe42ee33b9386be1c5e846a0200f3393705526e234789bbe4ac';
const FORMER_PAYLOAD_METRICS = Object.freeze({
  unicodeChars: 4961,
  lfChars: 4961,
  crlfChars: 4983,
  utf8Bytes: 4977,
  sha256: FORMER_PAYLOAD_SHA256,
});
const BASE_TOP_BLOCK_METRICS = Object.freeze([
  Object.freeze({ unicodeChars: 2254, lfChars: 2254, crlfChars: 2279, utf8Bytes: 2254, sha256: 'd7a33366ebbcf85bbe7875c209185e3416371b6afbc28c9f5e1582ff8821aded' }),
  Object.freeze({ unicodeChars: 2703, lfChars: 2703, crlfChars: 2708, utf8Bytes: 2727, sha256: '8063c6b8feb5d3e6d7b10b0a68f87f59b76cec529cfedf7bca765415324d9440' }),
]);
const BASE_TOP_FIELD_METRICS = Object.freeze({
  unicodeChars: 4958,
  lfChars: 4958,
  crlfChars: 4989,
  utf8Bytes: 4982,
  sha256: 'dd065a6779a5c8d7f4e439a54a8548d4dbb32120f33c2470dab190c364b0f8f5',
});

const SOURCE_CONTRACT_MUTATIONS = Object.freeze([
  ['current-information lookup', 'Search for the latest information whenever the topic may have changed.', 'Use available information.'],
  ['facts-versus-assumptions distinction', 'Separate facts, assumptions, inferences, opinions, and recommendations.', 'Verify sources.'],
  ['explicit uncertainty', 'Explain nuance, uncertainty, and source conflicts.', 'Explain details.'],
  ['no invented precision', 'never invent precision, probabilities, ROI, confidence ranges, or estimates.', 'use precision.'],
  ['inline citations', 'Cite sources inline beside claims; never rely only on a Sources panel or chip.', 'Cite sources.'],
  ['source-tier preference', 'Prefer: Official/primary > expert > reputable secondary/news > low-trust.', 'Prefer reliable sources.'],
  ['opened-source-only citation', 'Do not cite sources not opened and checked.', 'Cite sources without checking.'],
  ['user-link inspection', 'When I provide a link, open and inspect it before answering', 'When I provide a link, use it without inspection'],
  ['snippet-only avoidance', 'do not rely on snippets, titles, summaries, cached descriptions or prior knowledge', 'rely on snippets, titles, summaries, cached descriptions or prior knowledge'],
  ['practical cross-checking', 'Cross-check material claims with 2+ independent reliable sources where possible.', 'Cross-check material claims where possible.'],
  ['authoritative primary artefact', 'A directly inspected authoritative primary artefact may suffice for its own contents; verify important external implications separately.', 'A source may be enough.'],
  ['access-failure disclosure', 'If source or tool access fails, state exactly what could not be verified.', 'State uncertainty.'],
  ['explicit material inferences', 'Wrap any material unverified claim in ' + String.fromCharCode(96) + '[INFERENCE START]' + String.fromCharCode(96) + ' and ' + String.fromCharCode(96) + '[INFERENCE END]' + String.fromCharCode(96) + ', stating reasoning, assumptions, and supporting source.', 'Label claims.'],
]);

const PER_RUN_STAGING_MUTATIONS = Object.freeze([
  ['completed substantive-run disposition', 'Every terminal completed substantive run is dispositioned individually.', 'Completed runs are dispositioned collectively.'],
  ['evaluable-run candidate staging', 'For every evaluable G3, G4, or other substantive run, Web stages one public-safe evaluation-candidate:v1 before accept, merge, close, or dispatching the next run or task.', 'Web stages candidates later.'],
  ['non-evaluable reason', 'For a non-evaluable run, Web records a durable non-evaluable reason before the same boundary.', 'Non-evaluable runs are ignored.'],
  ['G3 AMEND staging before dispatch', 'A completed G3 AMEND must be staged before dispatching its next G3 amendment.', 'A completed G3 AMEND may dispatch its next amendment.'],
  ['G4 candidate timing and non-prerequisite', 'A G4 candidate is staged after its result, but G4 is not a prerequisite for staging earlier G3 runs.', 'G4 candidate timing is unspecified.'],
  ['Ledger queue before boundary', 'After the corresponding evaluation candidate or durable non-evaluable reason exists, Web serialises and queues the valid ledger-intake:v1 before accept, merge, close, or dispatching the next run or task.', 'Web queues intake later.'],
]);

function readAtRevision(revision, relativePath) {
  return execFileSync('git', ['show', revision + ':' + relativePath], { encoding: 'utf8' });
}

function deriveFormerPayload() {
  const source = normalizeLf(readAtRevision(BASE_COMMIT, 'CUSTOM_INSTRUCTIONS.md'));
  const section = source.slice(source.indexOf('## More About You'));
  const fence = String.fromCharCode(96).repeat(3);
  const pattern = new RegExp(fence + 'text\\n([\\s\\S]*?)\\n' + fence, 'g');
  const blocks = [...section.matchAll(pattern)].map((match) => match[1]);
  return { blocks, payload: blocks.join('\n') };
}

function deriveBaseTopField() {
  const source = normalizeLf(readAtRevision(BASE_COMMIT, 'CUSTOM_INSTRUCTIONS.md'));
  const sectionStart = source.indexOf('## Custom Instructions');
  const sectionEnd = source.indexOf('\n## More About You', sectionStart);
  assert.ok(sectionStart >= 0 && sectionEnd > sectionStart, 'canonical top-field section missing');
  const section = source.slice(sectionStart, sectionEnd);
  const fence = String.fromCharCode(96).repeat(3);
  const pattern = new RegExp(fence + 'text\n([\\s\\S]*?)\n' + fence, 'g');
  const blocks = [...section.matchAll(pattern)].map((match) => match[1]);
  assert.equal(blocks.length, 2, 'canonical base must contain exactly two top-field fences');
  return { blocks, payload: blocks.join('\n') };
}

function replaceSourceBlocks(document, transform) {
  const fence = String.fromCharCode(96).repeat(3);
  const pattern = new RegExp(
    '(<!-- immutable-source-block:\\d -->\n' + fence + 'text\n)([\\s\\S]*?)(\n' + fence + '\n<!-- /immutable-source-block:\\d -->)',
    'g',
  );
  let index = 0;
  return document.replace(pattern, (whole, prefix, body, suffix) => prefix + transform(body, index++) + suffix);
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = text.indexOf(needle, offset);
    if (found < 0) return count;
    count += 1;
    offset = found + needle.length;
  }
}

function readFixturePayload() {
  const fixture = fs.readFileSync(path.join(root, LEGACY_FIXTURE_FILE), 'utf8');
  assert.equal(fixture.endsWith('\n'), true, 'legacy fixture must have a terminal LF');
  assert.equal(fixture.endsWith('\n\n'), false, 'legacy fixture must contain exactly one terminal LF');
  return fixture.slice(0, -1);
}

function enforceObservedUiLimit(payload, limit = 1500) {
  const count = Array.from(payload).length;
  if (count > limit) throw new Error('payload exceeds observed 1,500-character control: ' + count);
}

function assertExactFormerFixture(candidate, expected) {
  assert.equal(candidate, expected, 'legacy fixture content identity mismatch');
  assert.deepEqual(measurePayload(candidate), FORMER_PAYLOAD_METRICS, 'legacy fixture metrics mismatch');
}

test('RED-first amendment regression rejects the pre-fix candidate', () => {
  const parentCustom = readAtRevision(AMENDMENT_PARENT, 'CUSTOM_INSTRUCTIONS.md');
  const parentProtocol = readAtRevision(AMENDMENT_PARENT, 'GOVERNED_REPOSITORY_PROTOCOL.md');
  const parentTest = readAtRevision(AMENDMENT_PARENT, 'tests/capacity-validation.test.cjs');
  const parentReport = validateText(parentCustom, parentProtocol);

  assert.ok(parentReport.errors.some((error) => /task-specific authority/.test(error)));
  assert.ok(parentReport.errors.some((error) => /Ledger ordering/.test(error)));
  assert.match(parentTest, /'x'\.repeat\(4961\)/);
});

test('RED-first A2 regression rejects the rewritten top-field candidate', () => {
  const parentCustom = readAtRevision(A2_AMENDMENT_PARENT, 'CUSTOM_INSTRUCTIONS.md');
  const parentProtocol = readAtRevision(A2_AMENDMENT_PARENT, 'GOVERNED_REPOSITORY_PROTOCOL.md');
  const report = validateText(parentCustom, parentProtocol);
  assert.ok(report.errors.some((error) => /top-field identity/.test(error)), report.errors.join('\n'));
});

test('derives the canonical top field from base and proves exact identity', () => {
  const sourceBlob = execFileSync('git', ['rev-parse', BASE_COMMIT + ':CUSTOM_INSTRUCTIONS.md'], { encoding: 'utf8' }).trim();
  assert.equal(sourceBlob, FORMER_SOURCE_BLOB);

  const derived = deriveBaseTopField();
  const parsed = parsePayloads(canonicalCustom);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.sourceBlocks, derived.blocks);
  assert.equal(parsed.payloads['Custom Instructions'], derived.payload);
  assert.equal(derived.payload, derived.blocks[0] + '\n' + derived.blocks[1]);
  assert.notEqual(derived.blocks[0] + derived.blocks[1], derived.payload);
  assert.deepEqual(derived.blocks.map(measurePayload), BASE_TOP_BLOCK_METRICS);
  assert.deepEqual(measurePayload(derived.payload), BASE_TOP_FIELD_METRICS);
  assert.deepEqual(measurePayload(parsed.payloads['Custom Instructions']), BASE_TOP_FIELD_METRICS);

  assert.equal(countOccurrences(canonicalCustom, derived.blocks[0]), 1);
  assert.equal(countOccurrences(canonicalCustom, derived.blocks[1]), 1);
  assert.equal(countOccurrences(canonicalCustom, '<!-- immutable-source-block:1 -->'), 1);
  assert.equal(countOccurrences(canonicalCustom, '<!-- immutable-source-block:2 -->'), 1);
  assert.ok(canonicalCustom.indexOf(derived.blocks[0]) < canonicalCustom.indexOf(derived.blocks[1]));
});

test('rejects every top-field identity mutation, including wording, punctuation, whitespace, order, and block swap', () => {
  const derived = deriveBaseTopField();
  const mutations = [
    ['one-character wording', (body, index) => index === 0 ? body.replace('Entertainment', 'EntertainmenT') : body],
    ['punctuation', (body, index) => index === 0 ? body.replace('For risky moves: Show Pros/Cons', 'For risky moves, Show Pros/Cons') : body],
    ['whitespace', (body, index) => index === 0 ? body.replace('# Verification Quality', '# Verification  Quality') : body],
    ['line order', (body, index) => index === 0 ? body.replace(
      '* If I am wrong, state the error directly and explain why.\n* For risky moves: Show Pros/Cons and recommend a clear side.',
      '* For risky moves: Show Pros/Cons and recommend a clear side.\n* If I am wrong, state the error directly and explain why.',
    ) : body],
    ['remove one line', (body, index) => index === 0 ? body.replace('* Give useful suggestions together; do not drip-feed.\n', '') : body],
    ['add one line', (body, index) => index === 0 ? body + '\n* Added identity-test line.' : body],
    ['swap blocks', (body, index) => index === 0 ? derived.blocks[1] : derived.blocks[0]],
  ];

  for (const [label, mutate] of mutations) {
    const report = validateText(replaceSourceBlocks(canonicalCustom, mutate), canonicalProtocol);
    assert.ok(report.errors.some((error) => /top-field identity/.test(error)), label + ': ' + report.errors.join('\n'));
  }
});

test('documents owner preservation and does not require top-field repaste', () => {
  assert.match(canonicalCustom, /Leave the already-saved top field untouched\./);
  assert.match(canonicalCustom, /literal contents of the two immutable Custom Instructions source blocks[\s\S]*joined with exactly one LF using the original documented copy method\./);
  assert.match(canonicalCustom, /paste and save only the replacement More about you payload\./);
  assert.match(canonicalCustom, /GOVERNED_REPOSITORY_PROTOCOL\.md remains the mandatory readable detailed module/);
  assert.doesNotMatch(canonicalCustom, /\b(?:paste|repaste)\b(?: and save)? (?:the )?(?:top|Custom Instructions) field/i);

  for (const pattern of [
    /Leave the already-saved top field untouched\./gi,
    /joined with exactly one LF using the original documented copy method\./gi,
    /paste and save only the replacement More about you payload\./gi,
    /GOVERNED_REPOSITORY_PROTOCOL\.md remains the mandatory readable detailed module/gi,
  ]) {
    const report = validateText(canonicalCustom.replace(pattern, ''), canonicalProtocol);
    assert.ok(report.errors.some((error) => /owner-preservation/.test(error)), pattern.source);
  }
});

test('derives and freezes the exact former two-block payload identity', () => {
  const sourceBlob = execFileSync('git', ['rev-parse', BASE_COMMIT + ':CUSTOM_INSTRUCTIONS.md'], { encoding: 'utf8' }).trim();
  assert.equal(sourceBlob, FORMER_SOURCE_BLOB);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD:' + LEGACY_FIXTURE_FILE], { encoding: 'utf8' }).trim(), FORMER_FIXTURE_BLOB);

  const derived = deriveFormerPayload();
  const fixture = readFixturePayload();
  assert.equal(derived.blocks.length, 2);
  assert.deepEqual(derived.blocks.map(measurePayload), [
    { unicodeChars: 248, lfChars: 248, crlfChars: 252, utf8Bytes: 250, sha256: '698d93b97c2819d1bdba4782651f65144fb1d0d42c2fb0bb7f930261e8858459' },
    { unicodeChars: 4712, lfChars: 4712, crlfChars: 4729, utf8Bytes: 4726, sha256: 'e77ed1f7221c32caeda2404616aaec132099b2d11b694451cf3bb401afeffea2' },
  ]);
  assertExactFormerFixture(fixture, derived.payload);
  assert.deepEqual(measurePayload(fixture), FORMER_PAYLOAD_METRICS);
  assert.ok(fixture.length > 1500);
  assert.throws(() => enforceObservedUiLimit(fixture), /1,500-character control/);

  const mutated = '?' + fixture.slice(1);
  assert.throws(() => assertExactFormerFixture(mutated, fixture), /identity mismatch/);
});

test('extracts exactly two payloads and validates the canonical documents', () => {
  const report = validateFiles(root);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.deepEqual(Object.keys(report.payloads), ['Custom Instructions', 'More about you']);
  assert.deepEqual(report.measurements['Custom Instructions'], measurePayload(report.payloads['Custom Instructions']));
  assert.deepEqual(report.measurements['More about you'], measurePayload(report.payloads['More about you']));
  assert.deepEqual(report.measurements['Custom Instructions'], BASE_TOP_FIELD_METRICS);
  assert.deepEqual(report.measurements['More about you'], {
    unicodeChars: 851,
    lfChars: 851,
    crlfChars: 865,
    utf8Bytes: 851,
    sha256: '88c2aaaa8d5c57c82d60d10ab5cc5aa1bb5c05ffe79b596b3808a29de4570050',
  });
  assert.ok(report.measurements['More about you'].unicodeChars <= PAYLOAD_LIMITS['More about you'].unicodeChars);
  assert.ok(report.measurements['More about you'].crlfChars <= PAYLOAD_LIMITS['More about you'].crlfChars);
  assert.ok(1500 - report.measurements['More about you'].unicodeChars >= 300);
});

test('enforces every source-verification behaviour and rejects negative mutations', () => {
  const report = validateText(canonicalCustom, canonicalProtocol);
  assert.equal(report.ok, true, report.errors.join('\n'));

  for (const [label, needle, replacement] of SOURCE_CONTRACT_MUTATIONS) {
    assert.ok(canonicalCustom.includes(needle), 'source-contract test needle missing: ' + label);
    const mutated = canonicalCustom.replace(needle, replacement);
    const mutatedReport = validateText(mutated, canonicalProtocol);
    assert.ok(
      mutatedReport.errors.some((error) => error.includes('source-verification contract: ' + label)),
      label + ': ' + mutatedReport.errors.join('\n'),
    );
  }
});

test('rejects task-specific authority and concrete Git objects in reusable documents', () => {
  assert.deepEqual(findTaskSpecificAuthorityViolations(canonicalCustom, canonicalProtocol), []);

  for (const injected of [
    'CI-047',
    'luna/ci-047-capacity-kernel-modularisation',
    'weijunswj/Custom-Instruction-Framework-For-Web-based-LLMs',
    BASE_COMMIT,
    'a'.repeat(40),
  ]) {
    const customReport = validateText(canonicalCustom + '\n' + injected + '\n', canonicalProtocol);
    const protocolReport = validateText(canonicalCustom, canonicalProtocol + '\n' + injected + '\n');
    assert.ok(customReport.errors.some((error) => /task-specific authority/.test(error)), injected);
    assert.ok(protocolReport.errors.some((error) => /task-specific authority/.test(error)), injected);
  }
});

test('enforces Ledger ordering and rejects each prior regression', () => {
  const currentErrors = [];
  checkLedgerOrdering(canonicalProtocol, currentErrors);
  assert.deepEqual(currentErrors, []);

  const sourceGate = canonicalProtocol.replace(
    'The current source PR does not have to merge before its intake is queued.',
    'Queue it only after the prior source PR is merged.',
  );
  const sourceGateErrors = [];
  checkLedgerOrdering(sourceGate, sourceGateErrors);
  assert.ok(sourceGateErrors.some((error) => /obsolete source-PR merge gate/.test(error)));
  assert.ok(sourceGateErrors.some((error) => /current source PR is not a prerequisite/.test(error)));

  const confusedPriorPr = canonicalProtocol.replace(
    'Any earlier Ledger-intake PR must already be merged.',
    'Any earlier source PR must already be merged.',
  );
  const confusedErrors = [];
  checkLedgerOrdering(confusedPriorPr, confusedErrors);
  assert.ok(confusedErrors.some((error) => /prior Ledger-intake PR constraint/.test(error)));
});

test('enforces per-run evaluation and Ledger staging before dispatch and finality', () => {
  const report = validateText(canonicalCustom, canonicalProtocol);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.match(canonicalProtocol, /Final acceptance still requires a fresh exact-head G4 PASS\./);
  assert.match(canonicalProtocol, /G4 is not a prerequisite for staging earlier G3 runs\./);

  for (const [label, needle, replacement] of PER_RUN_STAGING_MUTATIONS) {
    assert.ok(canonicalProtocol.includes(needle), 'per-run staging test needle missing: ' + label);
    const mutated = canonicalProtocol.replace(needle, replacement);
    const mutatedReport = validateText(canonicalCustom, mutated);
    assert.ok(
      mutatedReport.errors.some((error) => error.includes('per-run evaluation/Ledger staging: ' + label)),
      label + ': ' + mutatedReport.errors.join('\n'),
    );
  }

  const g4Only = canonicalProtocol.replace(
    'For every evaluable G3, G4, or other substantive run, Web stages one public-safe evaluation-candidate:v1 before accept, merge, close, or dispatching the next run or task.',
    'After G4 PASS, Web stages one public-safe evaluation-candidate:v1.',
  );
  const g4OnlyReport = validateText(canonicalCustom, g4Only);
  assert.ok(g4OnlyReport.errors.some((error) => /forbidden G4-only staging prerequisite/.test(error)));
});

test('rejects extra or ambiguous payload blocks', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const extraFence = canonicalCustom.replace(
    '<!-- payload:more-about-you -->',
    '<!-- payload:more-about-you -->\n' + fence + 'text\nambiguous\n' + fence,
  );
  assert.throws(() => extractPayloads(extraFence), /exactly three balanced payload fences|exactly one replacement payload fence/);

  const duplicateHeading = canonicalCustom.replace(
    '## More about you',
    '## More about you\n\n## More about you',
  );
  assert.throws(() => extractPayloads(duplicateHeading), /exactly two UI payload headings|required order/);
});

test('produces identical validation and measurements for LF and CRLF inputs', () => {
  const customLf = normalizeLf(canonicalCustom);
  const protocolLf = normalizeLf(canonicalProtocol);
  const lfReport = validateText(customLf, protocolLf);
  const crlfReport = validateText(customLf.replace(/\n/g, '\r\n'), protocolLf.replace(/\n/g, '\r\n'));
  assert.equal(lfReport.ok, true, lfReport.errors.join('\n'));
  assert.equal(crlfReport.ok, true, crlfReport.errors.join('\n'));
  assert.deepEqual(crlfReport.measurements, lfReport.measurements);
  assert.deepEqual(crlfReport.payloads, lfReport.payloads);
});

test('enforces UTF-8, terminal LF, trailing-whitespace, and balanced-fence hygiene', () => {
  const bomReport = validateBuffers(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(canonicalCustom)]),
    Buffer.from(canonicalProtocol),
  );
  assert.match(bomReport.errors.join('\n'), /UTF-8 BOM/);

  const noTerminalLf = validateText(canonicalCustom.replace(/\n$/, ''), canonicalProtocol);
  assert.match(noTerminalLf.errors.join('\n'), /CUSTOM_INSTRUCTIONS\.md: terminal LF/);

  const firstPayloadLine = canonicalCustom
    .split('\n')
    .find((line) => line.startsWith('* PRIORITY: Accuracy'));
  const trailingWhitespace = validateText(
    canonicalCustom.replace(firstPayloadLine, firstPayloadLine + ' '),
    canonicalProtocol,
  );
  assert.match(trailingWhitespace.errors.join('\n'), /CUSTOM_INSTRUCTIONS\.md: trailing whitespace/);

  const fence = String.fromCharCode(96).repeat(3);
  const unbalancedFence = validateText(canonicalCustom.replace(fence + 'text', fence + 'plain'), canonicalProtocol);
  assert.match(unbalancedFence.errors.join('\n'), /unsupported or ambiguous Markdown fence/);
});
