import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runUriCase } from '../src/cases/uri-template.mjs';
import { runBoundedProcess } from '../src/process-supervisor.mjs';
import { renderMarkdown } from '../src/report.mjs';
import { makeBundle } from './fixtures/evidence-bundle.mjs';

const expectedVersions = new Map([
  ['mcp-sdk-1251', '1.25.1'],
  ['mcp-sdk-1252', '1.25.2'],
]);

const runBoth = async (caseId) => Promise.all(
  [...expectedVersions.keys()].map((sdkAlias) => runUriCase({ sdkAlias, caseId, timeoutMs: 2_000 })),
);

test('valid_exploded_path_matches_on_both_versions', async () => {
  const results = await runBoth('path-valid');

  for (const result of results) {
    assert.equal(result.sdkVersion, expectedVersions.get(result.packageAlias));
    assert.equal(result.processStatus, 'completed');
    assert.equal(result.observed.matched, true);
    assert.deepEqual(result.observed.variables, { id: ['alpha', 'beta'] });
    assert.equal(result.passed, true);
  }
});

test('ordinary_nonmatch_returns_null_on_both_versions', async () => {
  const results = await runBoth('ordinary-no-match');

  for (const result of results) {
    assert.equal(result.sdkVersion, expectedVersions.get(result.packageAlias));
    assert.equal(result.processStatus, 'completed');
    assert.equal(result.observed.matched, false);
    assert.equal(result.observed.variables, null);
    assert.equal(result.passed, true);
  }
});

test('valid_simple_exploded_and_short_invalid_controls_agree_across_versions', async () => {
  const [simpleValid, pathInvalid, simpleInvalid] = await Promise.all([
    runBoth('simple-valid'),
    runBoth('path-invalid-control'),
    runBoth('simple-invalid-control'),
  ]);

  for (const result of simpleValid) {
    assert.equal(result.observed.matched, true);
    assert.deepEqual(result.observed.variables, { id: ['alpha', 'beta'] });
    assert.equal(result.passed, true);
  }
  for (const result of [...pathInvalid, ...simpleInvalid]) {
    assert.equal(result.processStatus, 'completed');
    assert.equal(result.observed.matched, false);
    assert.equal(result.passed, true);
  }
});

test('failing_exploded_path_times_out_or_exceeds_budget_on_1_25_1', async () => {
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1251', caseId: 'path-redos', timeoutMs: 2_000 });

  assert.equal(result.sdkVersion, '1.25.1');
  assert.equal(result.ready, true);
  assert.ok(
    result.processStatus === 'timeout' || result.observed.elapsedMs >= 250,
    `expected a timeout or >=250 ms match, got ${result.processStatus} in ${result.observed.elapsedMs} ms`,
  );
  assert.ok(result.observed.samples.length >= 4);
  assert.equal(result.passed, true);
});

test('same_failing_path_completes_under_budget_on_1_25_2', async () => {
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1252', caseId: 'path-redos', timeoutMs: 2_000 });

  assert.equal(result.sdkVersion, '1.25.2');
  assert.equal(result.processStatus, 'completed');
  assert.equal(result.observed.matched, false);
  assert.ok(result.observed.elapsedMs < 100);
  assert.equal(result.observed.samples.length, 6);
  assert.equal(result.passed, true);
});

test('failing_simple_exploded_pattern_times_out_or_exceeds_budget_on_1_25_1', async () => {
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1251', caseId: 'simple-redos', timeoutMs: 2_000 });

  assert.equal(result.sdkVersion, '1.25.1');
  assert.equal(result.ready, true);
  assert.ok(
    result.processStatus === 'timeout' || result.observed.elapsedMs >= 250,
    `expected a timeout or >=250 ms match, got ${result.processStatus} in ${result.observed.elapsedMs} ms`,
  );
  assert.ok(result.observed.samples.length >= 4);
  assert.equal(result.passed, true);
});

test('same_simple_exploded_pattern_completes_on_1_25_2', async () => {
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1252', caseId: 'simple-redos', timeoutMs: 2_000 });

  assert.equal(result.sdkVersion, '1.25.2');
  assert.equal(result.processStatus, 'completed');
  assert.equal(result.observed.matched, false);
  assert.ok(result.observed.elapsedMs < 100);
  assert.equal(result.observed.samples.length, 6);
  assert.equal(result.passed, true);
});

test('patch_reversal_fixture_is_detected_by_the_regression_case', async () => {
  const fixturePath = fileURLToPath(new URL('./fixtures/vulnerable-uri-template.mjs', import.meta.url));
  const result = await runBoundedProcess({
    command: process.execPath,
    args: [fixturePath, 'path-redos'],
    cwd: process.cwd(),
    timeoutMs: 2_000,
    maxOutputBytes: 64 * 1024,
  });

  assert.equal(result.status, 'timeout');
  assert.match(result.stderr, /^READY\tpath-redos\tfixture-vulnerable$/m);
});

test('rejects_unknown_sdk_aliases_and_case_names', async () => {
  await assert.rejects(
    runUriCase({ sdkAlias: 'mcp-sdk-current', caseId: 'path-valid', timeoutMs: 2_000 }),
    /unsupported SDK alias/i,
  );
  await assert.rejects(
    runUriCase({ sdkAlias: 'mcp-sdk-1252', caseId: 'arbitrary-input', timeoutMs: 2_000 }),
    /unsupported URI case/i,
  );
});

test('patched_redos_case_rejects_a_slow_completed_nonmatch', async () => {
  const sizes = [8, 12, 16, 20, 24, 28];
  const samples = sizes.map((size) => ({ size, elapsedNs: size === 28 ? 400_000_000 : 1_000_000, matched: false }));
  const processRunner = async () => ({
    status: 'completed', elapsedMs: 430,
    stdout: `${JSON.stringify({ caseId: 'path-redos', sdkVersion: '1.25.2', elapsedNs: '400000000', matched: false, variables: null, samples })}\n`,
    stderr: `READY\tpath-redos\t1.25.2\n${samples.map((sample) => `SAMPLE\t${JSON.stringify(sample)}`).join('\n')}\n`,
  });
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1252', caseId: 'path-redos', timeoutMs: 2_000, processRunner });
  assert.equal(result.expected, 'no_match_under_budget');
  assert.equal(result.observed.matched, false);
  assert.equal(result.passed, false);
});

test('patched_redos_case_rejects_an_earlier_slow_sample_even_when_the_last_is_fast', async () => {
  const samples = [8, 12, 16, 20, 24, 28].map((size) => ({
    size,
    elapsedNs: size === 24 ? 300_000_000 : 1_000_000,
    matched: false,
  }));
  const processRunner = async () => ({
    status: 'completed', elapsedMs: 330,
    stdout: `${JSON.stringify({
      caseId: 'path-redos', sdkVersion: '1.25.2', readyAtNs: '1',
      elapsedNs: '1000000', matched: false, variables: null, samples,
    })}\n`,
    stderr: `READY\tpath-redos\t1.25.2\n${samples.map((sample) => `SAMPLE\t${JSON.stringify(sample)}`).join('\n')}\n`,
  });

  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1252', caseId: 'path-redos', timeoutMs: 2_000, processRunner });

  assert.equal(result.expected, 'no_match_under_budget');
  assert.equal(result.observed.samples[4].elapsedMs, 300);
  assert.equal(result.observed.samples[5].elapsedMs, 1);
  assert.equal(result.passed, false);
});

test('pre_ready_timeout_is_preserved_as_inconclusive_evidence', async () => {
  const processRunner = async () => ({ status: 'timeout', elapsedMs: 1, stdout: '', stderr: '' });
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1251', caseId: 'path-redos', timeoutMs: 1, processRunner });
  assert.equal(result.sdkVersion, null);
  assert.equal(result.expected, 'slow_or_timeout');
  assert.equal(result.passed, false);
  const bundle = makeBundle([result, { ...result, packageAlias: 'mcp-sdk-1252', sdkVersion: '1.25.2', expected: 'no_match_under_budget' }]);
  assert.deepEqual(bundle.cases.map(({ verdict }) => verdict), ['inconclusive', 'inconclusive']);
  assert.match(renderMarkdown(bundle), /inconclusive/);
});

test('vulnerable_timeout_without_expected_growth_is_inconclusive', async () => {
  const samples = [8, 12, 16, 20].map((size) => ({ size, elapsedNs: 1_000_000, matched: false }));
  const processRunner = async () => ({
    status: 'timeout', elapsedMs: 2_000, stdout: '',
    stderr: `READY\tpath-redos\t1.25.1\n${samples.map((sample) => `SAMPLE\t${JSON.stringify(sample)}`).join('\n')}\n`,
  });
  const result = await runUriCase({ sdkAlias: 'mcp-sdk-1251', caseId: 'path-redos', timeoutMs: 2_000, processRunner });
  assert.equal(result.ready, true);
  assert.equal(result.processStatus, 'timeout');
  assert.equal(result.passed, false);
});
