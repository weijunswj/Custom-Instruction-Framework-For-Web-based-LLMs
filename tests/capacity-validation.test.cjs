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
const FORMER_SOURCE_BLOB = '23d589c88e51bc3e09a76f269e4a89157e385e7b';
const FORMER_PAYLOAD_SHA256 = '115d4d7a28d54fe42ee33b9386be1c5e846a0200f3393705526e234789bbe4ac';
const FORMER_PAYLOAD_METRICS = Object.freeze({
  unicodeChars: 4961,
  lfChars: 4961,
  crlfChars: 4983,
  utf8Bytes: 4977,
  sha256: FORMER_PAYLOAD_SHA256,
});

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

test('derives and freezes the exact former two-block payload identity', () => {
  const sourceBlob = execFileSync('git', ['rev-parse', BASE_COMMIT + ':CUSTOM_INSTRUCTIONS.md'], { encoding: 'utf8' }).trim();
  assert.equal(sourceBlob, FORMER_SOURCE_BLOB);

  const derived = deriveFormerPayload();
  const fixture = readFixturePayload();
  assert.equal(derived.blocks.length, 2);
  assert.deepEqual(derived.blocks.map((block) => block.length), [248, 4712]);
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
  assert.ok(report.measurements['Custom Instructions'].unicodeChars <= PAYLOAD_LIMITS['Custom Instructions'].unicodeChars);
  assert.ok(report.measurements['More about you'].unicodeChars <= PAYLOAD_LIMITS['More about you'].unicodeChars);
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

  const missingBeforeGate = canonicalProtocol.replaceAll('before accept, merge, close, or next dispatch', 'before dispatch');
  const missingGateErrors = [];
  checkLedgerOrdering(missingBeforeGate, missingGateErrors);
  assert.ok(missingGateErrors.some((error) => /G4 result and evaluation gate/.test(error)));
  assert.ok(missingGateErrors.some((error) => /intake before terminal governance actions/.test(error)));

  const confusedPriorPr = canonicalProtocol.replace(
    'Any earlier Ledger-intake PR must already be merged.',
    'Any earlier source PR must already be merged.',
  );
  const confusedErrors = [];
  checkLedgerOrdering(confusedPriorPr, confusedErrors);
  assert.ok(confusedErrors.some((error) => /prior Ledger-intake PR constraint/.test(error)));
});

test('rejects extra or ambiguous payload blocks', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const extraFence = canonicalCustom.replace(
    '<!-- payload:more-about-you -->',
    '<!-- payload:more-about-you -->\n' + fence + 'text\nambiguous\n' + fence,
  );
  assert.throws(() => extractPayloads(extraFence), /exactly two balanced payload fences|exactly one payload fence/);

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
    .find((line) => line.startsWith('Accuracy and verification come before'));
  const trailingWhitespace = validateText(
    canonicalCustom.replace(firstPayloadLine, firstPayloadLine + ' '),
    canonicalProtocol,
  );
  assert.match(trailingWhitespace.errors.join('\n'), /CUSTOM_INSTRUCTIONS\.md: trailing whitespace/);

  const fence = String.fromCharCode(96).repeat(3);
  const unbalancedFence = validateText(canonicalCustom.replace(fence + 'text', fence + 'plain'), canonicalProtocol);
  assert.match(unbalancedFence.errors.join('\n'), /unsupported or ambiguous Markdown fence/);
});
