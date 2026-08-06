'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const validator = require('../scripts/validate-custom-instructions.cjs');
const {
  LEGACY_FIXTURE_FILE,
  LEGACY_FIXTURE_METRICS,
  PAYLOAD_LIMITS,
  TOP_IMMUTABLE,
  TOP_ADDON,
  TOP_COMPLETE,
  RESPONSE_STYLE,
  CLOSURE_ADDON,
  MORE_COMPLETE,
  validateText,
  validateFiles,
  parsePayloads,
  measurePayload,
  normalizeLf,
  findTaskSpecificAuthorityViolations,
  inventoryReview,
  validateReviewPropagation,
  reviewMutationAllowed,
  truthfulReviewResolutionAllowed,
  admitLiveAuthority,
  headMovementInvalidates,
  assessTerminalEvidence,
  validateLifecycleQueue,
  selectFirstEligible,
  reconcileFourSurfaces,
  canProgressFromReconciliation,
  stageRunBoundary,
  ledgerAppendProof,
  LIVE_SECRET_CONTRACT_RULES,
  TOPOLOGY_PROTOCOL_RULES,
  FORBIDDEN_TOPOLOGY_PROTOCOL,
  checkLiveSecretContract,
  checkTopologyNeutralProtocol,
} = validator;

const root = path.resolve(__dirname, '..');
const customPath = path.join(root, 'CUSTOM_INSTRUCTIONS.md');
const protocolPath = path.join(root, 'GOVERNED_REPOSITORY_PROTOCOL.md');
const canonicalCustom = normalizeLf(fs.readFileSync(customPath, 'utf8'));
const canonicalProtocol = normalizeLf(fs.readFileSync(protocolPath, 'utf8'));
const BASE_COMMIT = 'd1e926f74d51f432de32bc8932501922765eae20';
const AMENDMENT_PARENT = 'edc87958dc73e8642d53bc7b3a0282455046c832';
const FORMER_SOURCE_BLOB = '23d589c88e51bc3e09a76f269e4a89157e385e7b';
const FORMER_FIXTURE_BLOB = '6fe5b92411f16d1f744f319ea1170060b456d4d3';
const FENCE = String.fromCharCode(96).repeat(3);
const NL = String.fromCharCode(10);

function readAtRevision(revision, relativePath) {
  return execFileSync('git', ['show', revision + ':' + relativePath], { encoding: 'utf8' });
}

function blocksUnder(text, heading, nextHeading) {
  const source = normalizeLf(text);
  const start = source.indexOf(heading);
  const end = nextHeading ? source.indexOf(nextHeading, start + heading.length) : source.length;
  const section = source.slice(start, end < 0 ? source.length : end);
  const blocks = [];
  const token = FENCE + 'text' + NL;
  let cursor = 0;
  while (true) {
    const open = section.indexOf(token, cursor);
    if (open < 0) break;
    const bodyStart = open + token.length;
    const close = section.indexOf(FENCE, bodyStart);
    if (close < 0) break;
    let body = section.slice(bodyStart, close);
    if (body.endsWith(NL)) body = body.slice(0, -1);
    blocks.push(body);
    cursor = close + FENCE.length;
  }
  return blocks;
}

function canonicalBaseBlocks() {
  const source = readAtRevision(BASE_COMMIT, 'CUSTOM_INSTRUCTIONS.md');
  return {
    top: blocksUnder(source, '## Custom Instructions', '## More About You')[0],
    more: blocksUnder(source, '## More About You')[0],
  };
}

function replaceExact(text, oldText, replacement) {
  const index = text.indexOf(oldText);
  assert.ok(index >= 0, 'mutation target missing');
  return text.slice(0, index) + replacement + text.slice(index + oldText.length);
}

function validationErrors(customText, protocolText = canonicalProtocol) {
  return validateText(customText, protocolText).errors;
}

function assertIdentityFailure(customText, label) {
  const errors = validationErrors(customText);
  assert.ok(errors.some((error) => /identity mismatch|expected exactly|source fence|block/.test(error)), label + ': ' + errors.join(NL));
}

function fixturePayload() {
  const content = normalizeLf(fs.readFileSync(path.join(root, LEGACY_FIXTURE_FILE), 'utf8'));
  assert.equal(content.endsWith(NL), true);
  assert.equal(content.endsWith(NL + NL), false);
  return content.slice(0, -1);
}

test('RED-first A6 proof rejects the exact amendment parent', () => {
  const parentCustom = readAtRevision(AMENDMENT_PARENT, 'CUSTOM_INSTRUCTIONS.md');
  const parentProtocol = readAtRevision(AMENDMENT_PARENT, 'GOVERNED_REPOSITORY_PROTOCOL.md');
  const parentTop = blocksUnder(parentCustom, '## Custom Instructions', '## More About You');
  const parentAddon = parentTop[1];
  assert.notEqual(measurePayload(parentAddon).sha256, TOP_ADDON.sha256);
  assert.equal(parentAddon.includes('Secrets:names only'), false);
  assert.match(parentProtocol, /## Secret protocol[\s\S]*confirmed[\s\S]*possible[\s\S]*none/);
  assert.equal(parentProtocol.includes('G3 is one fresh isolated implementation executor.'), true);
  assert.equal(parentProtocol.includes('G4 is one fresh isolated read-only reviewer'), true);
  assert.equal(parentProtocol.includes('replies to unresolved threads'), true);
  assert.equal(parentCustom.includes('These are the two original immutable Custom Instructions source blocks.'), true);
  assert.notEqual(measurePayload(parentAddon).crlf, 2644);
  const secretErrors = [];
  checkLiveSecretContract(parentAddon, secretErrors);
  assert.equal(secretErrors.length > 0, true);
  const topologyErrors = [];
  checkTopologyNeutralProtocol(parentProtocol, topologyErrors);
  assert.ok(topologyErrors.some((error) => error.includes('fixed G3 executor')));
  assert.ok(topologyErrors.some((error) => error.includes('fixed G4 route')));
  assert.ok(topologyErrors.some((error) => error.includes('universal G4 reply capability')));
  assert.ok(validationErrors(parentCustom).some((error) => error.includes('copy-guidance') || error.includes('live-secret-contract')));
});

test('canonical base source blocks and exact A6 assemblies have locked identity', () => {
  const baseBlob = execFileSync('git', ['rev-parse', BASE_COMMIT + ':CUSTOM_INSTRUCTIONS.md'], { encoding: 'utf8' }).trim();
  assert.equal(baseBlob, FORMER_SOURCE_BLOB);
  const base = canonicalBaseBlocks();
  const parsed = parsePayloads(canonicalCustom);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.sourceBlocks, [base.top, base.more]);
  assert.deepEqual(parsed.sourceBlocks.map(measurePayload), [TOP_IMMUTABLE, RESPONSE_STYLE]);
  assert.deepEqual(parsed.addOns.map(measurePayload), [TOP_ADDON, CLOSURE_ADDON]);
  assert.deepEqual(measurePayload(parsed.payloads['Custom Instructions']), TOP_COMPLETE);
  assert.deepEqual(measurePayload(parsed.payloads['More About You']), MORE_COMPLETE);
  assert.equal(canonicalCustom.split(base.top).length - 1, 1);
  assert.equal(canonicalCustom.split(base.more).length - 1, 1);
  assert.ok(canonicalCustom.indexOf(base.top) < canonicalCustom.indexOf(parsed.addOns[0]));
  assert.ok(canonicalCustom.indexOf(base.more) < canonicalCustom.indexOf(parsed.addOns[1]));
});

test('immutable wording, punctuation, whitespace, line order, swapping, duplication and removal all fail', () => {
  const base = canonicalBaseBlocks();
  const mutations = [
    ['wording', base.top.replace('Entertainment', 'EntertainmenT')],
    ['punctuation', base.top.replace('For risky moves: Show Pros/Cons', 'For risky moves, Show Pros/Cons')],
    ['whitespace', base.top.replace('# Verification Quality', '# Verification  Quality')],
    ['line order', base.top.replace(
      '* If I am wrong, state the error directly and explain why.' + NL + '* For risky moves: Show Pros/Cons and recommend a clear side.',
      '* For risky moves: Show Pros/Cons and recommend a clear side.' + NL + '* If I am wrong, state the error directly and explain why.',
    )],
  ];
  for (const [label, mutated] of mutations) assertIdentityFailure(replaceExact(canonicalCustom, base.top, mutated), label);
  const parsed = parsePayloads(canonicalCustom);
  const swapped = replaceExact(replaceExact(canonicalCustom, base.top, '__TOP__'), '__TOP__', parsed.addOns[1]);
  assertIdentityFailure(swapped, 'block swap');
  assertIdentityFailure(replaceExact(canonicalCustom, base.top, base.top + NL + base.top), 'duplicate immutable block');
  assertIdentityFailure(replaceExact(canonicalCustom, base.top, ''), 'missing immutable block');
});

test('both mutable add-ons reject one-character, line, order and fixed-route mutations', () => {
  const parsed = parsePayloads(canonicalCustom);
  const topAddon = parsed.addOns[0];
  const closureAddon = parsed.addOns[1];
  const topMutations = [
    topAddon.replace('Supersession', 'SupersessioN'),
    topAddon + NL + '* Added line.',
    topAddon.replace(
      '* Supersession: for governed coding work',
      '* User/current Web handoff is sole generic authority',
    ),
    topAddon.replace('No fixed model or host route.', 'OpenAI GPT-5.6 Luna is the fixed model route.'),
  ];
  for (const mutated of topMutations) assertIdentityFailure(replaceExact(canonicalCustom, topAddon, mutated), 'top add-on mutation');
  const closureMutations = [
    closureAddon.replace('authority', 'authoritY'),
    closureAddon + NL + '* Added line.',
    closureAddon.replace(
      '* One rolling parent is authority:',
      '* Every material transition atomically rereads/reconciles child,',
    ),
  ];
  for (const mutated of closureMutations) assertIdentityFailure(replaceExact(canonicalCustom, closureAddon, mutated), 'closure add-on mutation');
});

test('live top secret contract is parsed from the payload and every rule has a specific negative mutation', () => {
  const parsed = parsePayloads(canonicalCustom);
  const baselineErrors = [];
  checkLiveSecretContract(parsed.addOns[0], baselineErrors);
  assert.deepEqual(baselineErrors, []);
  for (const [label, needle] of LIVE_SECRET_CONTRACT_RULES) {
    const mutatedAddon = replaceExact(parsed.addOns[0], needle, '');
    const mutatedCustom = replaceExact(canonicalCustom, parsed.addOns[0], mutatedAddon);
    const errors = validationErrors(mutatedCustom);
    assert.ok(errors.includes('live-secret-contract: ' + label), label + ': ' + errors.join(NL));
  }
});

test('protocol topology is current-handoff selected and fixed-chain/capability mutations fail specifically', () => {
  const baselineErrors = [];
  checkTopologyNeutralProtocol(canonicalProtocol, baselineErrors);
  assert.deepEqual(baselineErrors, []);
  for (const [label, needle] of TOPOLOGY_PROTOCOL_RULES) {
    const mutated = canonicalProtocol.split(needle).join('');
    const errors = [];
    checkTopologyNeutralProtocol(mutated, errors);
    assert.ok(errors.includes('topology-neutral protocol: ' + label), label + ': ' + errors.join(NL));
  }
  const forbiddenMutations = [
    ['fixed G3 executor', 'G3 is one fresh isolated implementation executor.'],
    ['fixed G3 topology', 'G3 is the single implementation worker.'],
    ['fixed G4 route', 'G4 is one fresh isolated read-only reviewer after prerequisites.'],
    ['universal G4 reply capability', 'G4 is one fresh isolated read-only reviewer and replies to unresolved threads.'],
    ['universal reviewer mutation', 'Every reviewer may reply, resolve, reopen, or dismiss review conversations.'],
    ['fixed provider or model route', 'OpenAI GPT-5.6 is a fixed route.'],
    ['installation-selected topology', 'Installation selects the topology.'],
    ['capacity-selected topology', 'Available capacity chooses the route.'],
    ['availability-selected topology', 'Available workers select the worker.'],
    ['prior-grant-selected topology', 'Prior grants choose the topology.'],
  ];
  assert.equal(forbiddenMutations.length, FORBIDDEN_TOPOLOGY_PROTOCOL.length);
  for (const [label, injection] of forbiddenMutations) {
    const errors = [];
    checkTopologyNeutralProtocol(canonicalProtocol + NL + injection, errors);
    assert.ok(errors.includes('topology-neutral protocol: forbidden ' + label), label + ': ' + errors.join(NL));
  }
});

test('copy guidance identifies only the immutable source and exact mutable top add-on', () => {
  assert.equal(canonicalCustom.includes('The Decision/Verification source block below is immutable.'), true);
  assert.equal(canonicalCustom.includes('The Coding Governance Add-on is mutable by owner/Web Design Lock but exact within the currently accepted revision.'), true);
  assert.equal(canonicalCustom.includes('The logical top field is the immutable block followed by exactly one LF and the current exact add-on.'), true);
  const mutated = replaceExact(
    canonicalCustom,
    'The Decision/Verification source block below is immutable.',
    'These are the two original immutable Custom Instructions source blocks.',
  );
  const errors = validationErrors(mutated);
  assert.ok(errors.includes('copy-guidance: mutable add-on described as immutable'), errors.join(NL));
});

test('task-specific issue, repository, Git-object and mandatory-document injections fail', () => {
  for (const injected of ['#47', 'weijunswj/Custom-Instruction-Framework-For-Web-based-LLMs', 'a'.repeat(40), 'OpenAI GPT-5.6 Luna']) {
    const errors = validationErrors(canonicalCustom + NL + injected + NL);
    assert.ok(errors.some((error) => /task-specific authority/.test(error)), injected + ': ' + errors.join(NL));
  }
  const mandatory = canonicalProtocol.replace('not mandatory runtime context', 'mandatory runtime context');
  assert.ok(validationErrors(canonicalCustom, mandatory).some((error) => /external-document runtime dependency|mandatory runtime/.test(error)));
});

test('source-verification contract is present and each material behaviour mutation fails', () => {
  assert.equal(validateText(canonicalCustom, canonicalProtocol).ok, true, validateText(canonicalCustom, canonicalProtocol).errors.join(NL));
  const sourceBlock = canonicalBaseBlocks().top;
  const mutations = [
    ['latest lookup', 'Search for the latest information whenever the topic may have changed.', 'Use available information.'],
    ['fact distinction', 'Separate facts, assumptions, inferences, opinions, and recommendations.', 'Verify sources.'],
    ['uncertainty', 'Explain nuance, uncertainty, and source conflicts.', 'Explain details.'],
    ['precision', 'never invent precision, probabilities, ROI, confidence ranges, or estimates.', 'use precision.'],
    ['inline citations', 'Cite sources inline beside claims; never rely only on a Sources panel or chip.', 'Cite sources.'],
    ['source tier', 'Prefer: Official/primary > expert > reputable secondary/news > low-trust.', 'Prefer reliable sources.'],
    ['opened source', 'Do not cite sources not opened and checked.', 'Cite sources without checking.'],
    ['link inspection', 'When I provide a link, open and inspect it before answering', 'When I provide a link, use it without inspection'],
    ['snippet avoidance', 'do not rely on snippets, titles, summaries, cached descriptions or prior knowledge', 'rely on snippets, titles, summaries, cached descriptions or prior knowledge'],
    ['cross-checking', 'Cross-check material claims with 2+ independent reliable sources where possible.', 'Cross-check material claims where possible.'],
    ['primary artefact', 'A directly inspected authoritative primary artefact may suffice for its own contents; verify important external implications separately.', 'A source may be enough.'],
    ['access failure', 'If source or tool access fails, state exactly what could not be verified.', 'State uncertainty.'],
    ['inference', '[INFERENCE START]', '[INFERENCE NOTE]'],
  ];
  for (const [label, needle, replacement] of mutations) {
    assert.equal(sourceBlock.includes(needle), true, label + ' test needle missing');
    const errors = validationErrors(replaceExact(canonicalCustom, sourceBlock, sourceBlock.replace(needle, replacement)));
    assert.ok(errors.some((error) => error.includes('source-verification contract')), label + ': ' + errors.join(NL));
  }
});

test('review inventory keeps current, outdated, closed, merged and submitted-review findings active', () => {
  const records = [
    { id: 'current-inline', kind: 'thread', isResolved: false, isOutdated: false, prState: 'open', material: true },
    { id: 'outdated-inline', kind: 'thread', isResolved: false, isOutdated: true, prState: 'open', material: true },
    { id: 'closed-comment', kind: 'review-comment', isResolved: false, prState: 'closed', material: true },
    { id: 'merged-comment', kind: 'review-comment', isResolved: false, prState: 'merged', material: true },
    { id: 'blocking-review', kind: 'submitted-review', isResolved: false, state: 'CHANGES_REQUESTED', blocking: true, material: true },
  ];
  const inventory = inventoryReview(records);
  assert.equal(inventory.unresolvedInlineThreads.length, 2);
  assert.equal(inventory.unresolvedReviewComments.length, 2);
  assert.equal(inventory.blockingSubmittedReviews.length, 1);
  assert.equal(inventory.retainsOutdated, true);
  assert.equal(inventory.retainsClosedOrMerged, true);
  assert.equal(inventory.blocksProgress, true);
  assert.equal(validateReviewPropagation(inventory, 'next run').ok, false);
  assert.deepEqual(validateReviewPropagation(inventory, records.map((item) => item.id).join(' ')).missing, []);
  assert.equal(inventoryReview(records.concat({ id: 'follow-up', kind: 'thread', isResolved: false, material: false })).blocksProgress, true);
  assert.equal(truthfulReviewResolutionAllowed({ isResolved: true, evidenceBacked: false, completionEvidence: 'done' }), false);
  assert.equal(truthfulReviewResolutionAllowed({ isResolved: true, evidenceBacked: true, completionEvidence: 'exact-head evidence' }), true);
  assert.equal(reviewMutationAllowed({ role: 'G3', actor: 'web', capability: 'authorised-review-capability' }), false);
  assert.equal(reviewMutationAllowed({ role: 'Web', actor: 'web' }), true);
});

test('live metadata authority is exact, missing evidence fails closed, and head movement invalidates', () => {
  const expected = {
    repo: 'owner/repo',
    branch: 'implementation',
    base: 'base',
    head: 'head',
    tree: 'tree',
    blobs: { custom: 'blob' },
    scope: ['CUSTOM_INSTRUCTIONS.md'],
  };
  assert.equal(admitLiveAuthority({ actual: { ...expected }, expected }).ok, true);
  assert.equal(admitLiveAuthority({ actual: { ...expected, head: 'other' }, expected }).ok, false);
  const missing = { ...expected };
  delete missing.tree;
  delete missing.blobs;
  assert.equal(admitLiveAuthority({ actual: missing, expected }).ok, false);
  assert.equal(headMovementInvalidates(expected, expected), false);
  assert.equal(headMovementInvalidates(expected, { ...expected, head: 'moved' }), true);
});

test('timeout, missing terminal summary and empty hosted evidence are never PASS or green', () => {
  assert.equal(assessTerminalEvidence({ timedOut: true, terminalSummary: 'PASS' }).status, 'INCONCLUSIVE');
  assert.equal(assessTerminalEvidence({}).status, 'INCONCLUSIVE');
  assert.equal(assessTerminalEvidence({
    terminalSummary: 'PASS',
    status: 'PASS',
    statuses: [],
    checks: [],
    runs: [],
    workflows: [],
  }).status, 'ABSENT_NOT_GREEN');
  assert.deepEqual(assessTerminalEvidence({
    terminalSummary: 'PASS',
    status: 'PASS',
    statuses: ['success'],
    checks: ['success'],
    runs: ['success'],
    workflows: ['success'],
  }), { status: 'PASS', pass: true, hosted: 'COMPLETE' });
});

test('complete validator pass proves protocol maintenance-only semantics and no fixed route', () => {
  const report = validateFiles(root);
  assert.equal(report.ok, true, report.errors.join(NL));
  assert.deepEqual(findTaskSpecificAuthorityViolations(canonicalCustom, canonicalProtocol), []);
  assert.equal(canonicalProtocol.includes('not mandatory runtime context'), true);
  assert.equal(canonicalProtocol.includes('not a runtime dependency'), true);
  assert.equal(canonicalCustom.includes('GPT-5.6'), false);
  assert.equal(canonicalCustom.includes('OpenAI'), false);
  assert.equal(canonicalCustom.includes('luna/ci-047'), false);
});

test('rolling queue rejects duplicates, competing queues, early final audit, and wrong pickup', () => {
  const valid = [
    { id: 'child-1', eligible: false },
    { id: 'child-2', eligible: true },
    { id: 'programme-final-audit', eligible: true, finalAudit: true },
  ];
  const validReport = validateLifecycleQueue(valid);
  assert.equal(validReport.ok, true, validReport.errors.join(NL));
  assert.equal(validReport.firstEligible.id, 'child-2');
  assert.equal(selectFirstEligible(valid).id, 'child-2');
  assert.equal(validateLifecycleQueue(valid.concat({ id: 'child-2', eligible: true })).ok, false);
  assert.equal(validateLifecycleQueue([{ id: 'child-1', queues: ['active', 'current'] }]).ok, false);
  assert.equal(validateLifecycleQueue([{ id: 'programme-final-audit', finalAudit: true }, { id: 'child-1', eligible: true }]).ok, false);
  assert.equal(validateLifecycleQueue([{ id: 'child-1', eligible: false }, { id: 'child-2', eligible: true }]).firstEligible.id, 'child-2');
});

test('four-surface reconciliation blocks every progression action until exact', () => {
  const surfaces = {
    child: { id: 47, head: 'head' },
    pr: { number: 48 },
    parentEntry: { childId: 47, prNumber: 48, head: 'head' },
    chronology: { childId: 47, prNumber: 48, head: 'head' },
  };
  const complete = reconcileFourSurfaces(surfaces);
  assert.equal(complete.ok, true);
  assert.equal(complete.code, 'RECONCILED');
  assert.equal(canProgressFromReconciliation(complete), true);
  const incomplete = reconcileFourSurfaces({ ...surfaces, parentEntry: [] });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.code, 'PARENT_RECONCILIATION_INCOMPLETE');
  assert.equal(canProgressFromReconciliation(incomplete), false);
  const mismatch = reconcileFourSurfaces({ ...surfaces, chronology: { childId: 47, prNumber: 48, head: 'moved' } });
  assert.equal(mismatch.code, 'PARENT_RECONCILIATION_INCOMPLETE');
  assert.equal(canProgressFromReconciliation(mismatch), false);
});

test('per-run evaluation and Ledger ordering blocks another dispatch until staged', () => {
  const blocked = stageRunBoundary({ runId: 'run-006', result: 'AMEND', ledgerQueued: false });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.blocksNextDispatch, true);
  const staged = stageRunBoundary({
    runId: 'run-006',
    result: 'AMEND',
    evaluationCandidate: { runId: 'run-006' },
    ledgerQueued: true,
    sourcePrMerged: false,
  });
  assert.equal(staged.ok, true);
  assert.equal(staged.sourcePrMergeRequired, false);
  assert.equal(staged.appendProven, false);
  assert.equal(ledgerAppendProof({ queued: true, runId: 'run-006' }), false);
  assert.equal(ledgerAppendProof({
    queued: true,
    runId: 'run-006',
    receipt: { kind: 'ledger-recorded:v1', processor: true, runId: 'run-006' },
  }), true);
  const nonEvaluable = stageRunBoundary({ runId: 'run-007', nonEvaluableReason: 'durable reason', ledgerQueued: true });
  assert.equal(nonEvaluable.ok, true);
});

test('legacy fixture remains exact and rejects the observed 1,500-character control', () => {
  const sourceBlob = execFileSync('git', ['rev-parse', BASE_COMMIT + ':CUSTOM_INSTRUCTIONS.md'], { encoding: 'utf8' }).trim();
  const fixtureBlob = execFileSync('git', ['rev-parse', 'HEAD:' + LEGACY_FIXTURE_FILE], { encoding: 'utf8' }).trim();
  assert.equal(sourceBlob, FORMER_SOURCE_BLOB);
  assert.equal(fixtureBlob, FORMER_FIXTURE_BLOB);
  const fixture = fixturePayload();
  assert.deepEqual(measurePayload(fixture), LEGACY_FIXTURE_METRICS);
  assert.ok(fixture.length > 1500);
  assert.throws(() => {
    if (Array.from(fixture).length > 1500) throw new Error('payload exceeds observed 1,500-character control');
  }, /1,500-character control/);
  assert.notDeepEqual(measurePayload('?' + fixture.slice(1)), LEGACY_FIXTURE_METRICS);
});

test('exact counts, hashes, limits and CRLF normalization remain stable', () => {
  const parsed = parsePayloads(canonicalCustom);
  assert.ok(parsed.addOns[0].length > 0);
  assert.equal(measurePayload(parsed.addOns[0]).crlfChars <= 2650, true);
  assert.equal(measurePayload(parsed.payloads['Custom Instructions']).crlfChars <= 4931, true);
  assert.equal(measurePayload(parsed.addOns[1]).crlfChars <= 1150, true);
  assert.equal(measurePayload(parsed.payloads['More About You']).crlfChars <= 1404, true);
  assert.equal(measurePayload(parsed.payloads['More About You']).unicodeChars < 1500, true);
  const crlfCustom = normalizeLf(canonicalCustom).replace(new RegExp(NL, 'g'), String.fromCharCode(13) + String.fromCharCode(10));
  const crlfProtocol = normalizeLf(canonicalProtocol).replace(new RegExp(NL, 'g'), String.fromCharCode(13) + String.fromCharCode(10));
  const report = validateText(crlfCustom, crlfProtocol);
  assert.equal(report.ok, true, report.errors.join(NL));
  assert.deepEqual(report.measurements, validateText(canonicalCustom, canonicalProtocol).measurements);
});

test('extra, missing and ambiguous fenced blocks fail closed', () => {
  const extra = canonicalCustom.replace(
    '<!-- mutable-source-block:governance-closure -->',
    FENCE + 'text' + NL + 'extra' + NL + FENCE + NL + '<!-- mutable-source-block:governance-closure -->',
  );
  assert.ok(validationErrors(extra).some((error) => /exactly four|fence/.test(error)));
  const missing = canonicalCustom.replace(FENCE + 'text' + NL + '# Governance & Closure', '# Governance & Closure');
  assert.ok(validationErrors(missing).some((error) => /exactly four|source fence|fence/.test(error)));
});

test('the full focused suite validates the exact committed documents', () => {
  const report = validateFiles(root);
  assert.equal(report.ok, true, report.errors.join(NL));
  assert.deepEqual(report.measurements['Custom Instructions'], TOP_COMPLETE);
  assert.deepEqual(report.measurements['More About You'], MORE_COMPLETE);
  assert.deepEqual(Object.keys(PAYLOAD_LIMITS).sort(), ['Custom Instructions', 'Custom Instructions add-on', 'More About You', 'More About You add-on'].sort());
});
