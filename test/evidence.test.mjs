import assert from 'node:assert/strict';
import test from 'node:test';

import { validateEvidence } from '../src/evidence.mjs';
import { renderMarkdown } from '../src/report.mjs';
import { makeBundle, rawCase } from './fixtures/evidence-bundle.mjs';

test('builds_allowlisted_evidence_and_stable_order', () => {
  const bundle = makeBundle([rawCase, { ...rawCase, caseId: 'ordinary-no-match' }]);
  assert.deepEqual(bundle.cases.map(({ caseId }) => caseId), ['ordinary-no-match', 'path-valid']);
  assert.equal(bundle.cases[1].input.shape, 'valid_exploded_path');
  assert.doesNotThrow(() => validateEvidence(bundle));
  assert.equal(renderMarkdown(bundle), renderMarkdown(structuredClone(bundle)));
});

test('rejects_unknown_fields_paths_headers_environment_keys_and_nonfinite_timings', () => {
  const attacks = [
    (b) => { b.extra = 'unexpected'; },
    (b) => { b.cases[0].observed.Authorization = 'secret'; },
    (b) => { b.cases[0].observed.cookie = 'session'; },
    (b) => { b.cases[0].observed.PATH = '/bin'; },
    (b) => { b.cases[0].limitations.push('/Users/example/private/file'); },
    (b) => { b.cases[0].limitations.push('Read /tmp/private-file'); },
    (b) => { b.cases[0].observed.elapsedMs = Infinity; },
    (b) => { b.cases[0].processStatus = 'unknown'; },
  ];
  for (const mutate of attacks) {
    const bundle = makeBundle();
    mutate(bundle);
    assert.throws(() => validateEvidence(bundle));
  }
});

test('inconclusive_case_remains_visible_in_both_formats', () => {
  const bundle = makeBundle([{ ...rawCase, processStatus: 'timeout', observed: { matched: null, variables: null, elapsedMs: 2000, samples: [] }, passed: false }]);
  assert.equal(bundle.cases[0].verdict, 'inconclusive');
  assert.match(JSON.stringify(bundle), /"verdict":"inconclusive"/);
  assert.match(renderMarkdown(bundle), /inconclusive/);
  assert.match(renderMarkdown(bundle), /path-valid/);
});
