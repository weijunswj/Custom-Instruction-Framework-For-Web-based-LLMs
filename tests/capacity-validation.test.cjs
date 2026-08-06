'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PAYLOAD_LIMITS,
  extractPayloads,
  measurePayload,
  normalizeLf,
  validateBuffers,
  validateFiles,
  validateText,
} = require('../scripts/validate-custom-instructions.cjs');

const root = path.resolve(__dirname, '..');
const customPath = path.join(root, 'CUSTOM_INSTRUCTIONS.md');
const protocolPath = path.join(root, 'GOVERNED_REPOSITORY_PROTOCOL.md');
const canonicalCustom = fs.readFileSync(customPath, 'utf8');
const canonicalProtocol = fs.readFileSync(protocolPath, 'utf8');

function enforceObservedUiLimit(payload, limit = 1500) {
  const count = Array.from(payload).length;
  if (count > limit) throw new Error('payload exceeds observed 1,500-character control: ' + count);
}

test('RED-first regression records the former 4,961-character More about you failure', () => {
  const formerPayload = 'x'.repeat(4961);
  assert.equal(formerPayload.length, 4961);
  assert.ok(formerPayload.length > 1500);
  assert.throws(() => enforceObservedUiLimit(formerPayload), /1,500-character control/);
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

test('rejects extra or ambiguous payload blocks', () => {
  const extraFence = canonicalCustom.replace(
    '<!-- payload:more-about-you -->',
    '<!-- payload:more-about-you -->\n```text\nambiguous\n```',
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
