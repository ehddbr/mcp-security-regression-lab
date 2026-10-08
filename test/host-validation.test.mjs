import assert from 'node:assert/strict';
import test from 'node:test';
import { localhostHostValidation } from 'mcp-sdk-1240/server/middleware/hostHeaderValidation.js';

import { runHostValidationMatrix, withLoopbackServer } from '../src/cases/host-validation.mjs';

let matrix;
const getMatrix = async () => {
  matrix ??= runHostValidationMatrix();
  return matrix;
};

test('legacy_setup_reaches_marker_for_disallowed_host', async () => {
  const result = (await getMatrix()).find(({ caseId }) => caseId === 'legacy-disallowed-host');
  assert.equal(result.sdkVersion, '1.23.1');
  assert.equal(result.observed.markerCount, 1);
  assert.equal(result.observed.statusCode, 406);
  assert.equal(result.passed, true);
});

test('protected_setup_rejects_disallowed_host_before_marker', async () => {
  const result = (await getMatrix()).find(({ caseId }) => caseId === 'protected-disallowed-host');
  assert.equal(result.sdkVersion, '1.24.0');
  assert.equal(result.observed.statusCode, 403);
  assert.equal(result.observed.markerCount, 0);
  assert.equal(result.passed, true);
});

test('protected_setup_accepts_127_0_0_1_with_port', async () => {
  const result = (await getMatrix()).find(({ caseId }) => caseId === 'protected-loopback-ip');
  assert.equal(result.observed.hostClass, 'loopback_ip_with_port');
  assert.equal(result.observed.markerCount, 1);
  assert.equal(result.observed.statusCode, 406);
  assert.equal(result.passed, true);
});

test('protected_setup_accepts_localhost_with_port', async () => {
  const result = (await getMatrix()).find(({ caseId }) => caseId === 'protected-localhost');
  assert.equal(result.observed.hostClass, 'localhost_with_port');
  assert.equal(result.observed.markerCount, 1);
  assert.equal(result.observed.statusCode, 406);
  assert.equal(result.passed, true);
});

test('protected_setup_rejects_missing_host', async () => {
  const result = (await getMatrix()).find(({ caseId }) => caseId === 'protected-missing-host');
  assert.equal(result.observed.hostClass, 'missing');
  assert.equal(result.observed.statusCode, 400);
  assert.equal(result.observed.markerCount, 0);
  assert.equal(result.passed, true);
});

test('sdk_middleware_rejects_missing_host_when_invoked', () => {
  let statusCode;
  let body;
  let nextCalled = false;
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  localhostHostValidation()({ headers: {} }, response, () => { nextCalled = true; });
  assert.equal(statusCode, 403);
  assert.equal(body.error.message, 'Missing Host header');
  assert.equal(nextCalled, false);
});

test('servers_close_after_success_and_failure', async () => {
  let successfulServer;
  const value = await withLoopbackServer((_request, response) => response.end('ok'), async ({ server, port }) => {
    successfulServer = server;
    assert.equal(server.address().address, '127.0.0.1');
    assert.ok(port > 0);
    return 'done';
  });
  assert.equal(value, 'done');
  assert.equal(successfulServer.listening, false);

  let failedServer;
  await assert.rejects(
    withLoopbackServer((_request, response) => response.end('ok'), async ({ server }) => {
      failedServer = server;
      throw new Error('deliberate callback failure');
    }),
    /deliberate callback failure/,
  );
  assert.equal(failedServer.listening, false);
});

test('host_probe_failure_is_inconclusive_per_case', async () => {
  const results = await runHostValidationMatrix({ probeRequest: async () => { throw new Error('simulated network failure'); } });
  assert.equal(results.length, 5);
  for (const result of results) {
    assert.equal(result.processStatus, 'crashed');
    assert.equal(result.passed, false);
    assert.equal(result.ready, false);
    assert.equal(result.observed.statusCode, 0);
  }
});
