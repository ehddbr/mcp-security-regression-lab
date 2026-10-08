import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSingleJsonLine,
  runBoundedProcess,
} from '../src/process-supervisor.mjs';

const nodeEval = (source) => ({
  command: process.execPath,
  args: ['--eval', source],
  cwd: process.cwd(),
  timeoutMs: 500,
  maxOutputBytes: 64 * 1024,
});

test('kills_and_reports_a_hung_child', async () => {
  const result = await runBoundedProcess(nodeEval(
    'process.stdout.write(String(process.pid) + "\\n"); setInterval(() => {}, 1000);',
  ));

  assert.equal(result.status, 'timeout');
  assert.equal(result.exitCode, null);
  assert.ok(result.signal === 'SIGTERM' || result.signal === 'SIGKILL');
  assert.ok(result.elapsedMs >= 400 && result.elapsedMs < 2_000);

  const childPid = Number.parseInt(result.stdout.trim(), 10);
  assert.ok(Number.isInteger(childPid));
  assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
});

test('rejects_partial_json_before_timeout', async () => {
  const result = await runBoundedProcess(nodeEval(
    'process.stdout.write("{\\\"ok\\\":"); setInterval(() => {}, 1000);',
  ));

  assert.equal(result.status, 'timeout');
  assert.throws(() => parseSingleJsonLine(result), /completed process/i);
});

test('reports_nonzero_exit_as_crashed', async () => {
  const result = await runBoundedProcess(nodeEval(
    'process.stderr.write("intentional failure\\n"); process.exit(7);',
  ));

  assert.equal(result.status, 'crashed');
  assert.equal(result.exitCode, 7);
  assert.equal(result.signal, null);
  assert.match(result.stderr, /intentional failure/);
});

test('caps_combined_output_at_64_kib', async () => {
  const result = await runBoundedProcess(nodeEval(
    'const chunk = "x".repeat(4096); setInterval(() => { process.stdout.write(chunk); process.stderr.write(chunk); }, 0);',
  ));

  assert.equal(result.status, 'output_limit');
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 64 * 1024);
  assert.ok(result.signal === 'SIGTERM' || result.signal === 'SIGKILL');
});

test('accepts_exactly_one_completed_json_line', async () => {
  const good = await runBoundedProcess(nodeEval(
    'process.stdout.write(JSON.stringify({ ok: true, count: 2 }) + "\\n");',
  ));
  assert.equal(good.status, 'completed');
  assert.deepEqual(parseSingleJsonLine(good), { ok: true, count: 2 });

  const multiple = await runBoundedProcess(nodeEval(
    'process.stdout.write("{\\\"a\\\":1}\\n{\\\"b\\\":2}\\n");',
  ));
  assert.equal(multiple.status, 'completed');
  assert.throws(() => parseSingleJsonLine(multiple), /exactly one JSON line/i);
});
