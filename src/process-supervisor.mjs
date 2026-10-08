import { spawn } from 'node:child_process';

import {
  DEFAULT_PROCESS_TIMEOUT_MS,
  MAX_PROCESS_OUTPUT_BYTES,
  PROCESS_KILL_GRACE_MS,
} from './constants.mjs';

const elapsedMilliseconds = (startedAt) =>
  Number(process.hrtime.bigint() - startedAt) / 1_000_000;

const assertOptions = ({ command, args, cwd, timeoutMs, maxOutputBytes }) => {
  if (typeof command !== 'string' || command.length === 0) {
    throw new TypeError('command must be a non-empty string');
  }
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string')) {
    throw new TypeError('args must be an array of strings');
  }
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new TypeError('cwd must be a non-empty string');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive integer');
  }
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new TypeError('maxOutputBytes must be a positive integer');
  }
};

export const runBoundedProcess = ({
  command,
  args = [],
  cwd,
  timeoutMs = DEFAULT_PROCESS_TIMEOUT_MS,
  maxOutputBytes = MAX_PROCESS_OUTPUT_BYTES,
}) => {
  assertOptions({ command, args, cwd, timeoutMs, maxOutputBytes });

  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    const stdoutChunks = [];
    const stderrChunks = [];
    let capturedBytes = 0;
    let forcedStatus = null;
    let terminationStarted = false;
    let settled = false;
    let killTimer;

    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const terminate = (status) => {
      if (terminationStarted) return;
      terminationStarted = true;
      forcedStatus = status;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, PROCESS_KILL_GRACE_MS);
      killTimer.unref();
    };

    const capture = (destination, chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = maxOutputBytes - capturedBytes;
      if (remaining > 0) {
        const kept = bytes.subarray(0, remaining);
        destination.push(kept);
        capturedBytes += kept.length;
      }
      if (bytes.length > remaining) terminate('output_limit');
    };

    child.stdout.on('data', (chunk) => capture(stdoutChunks, chunk));
    child.stderr.on('data', (chunk) => capture(stderrChunks, chunk));

    const timeout = setTimeout(() => terminate('timeout'), timeoutMs);
    timeout.unref();

    const finish = ({ exitCode, signal, spawnError }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(killTimer);

      const status = forcedStatus ?? (spawnError || exitCode !== 0 ? 'crashed' : 'completed');
      resolve({
        status,
        exitCode: exitCode ?? null,
        signal: signal ?? null,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        elapsedMs: elapsedMilliseconds(startedAt),
        ...(spawnError ? { error: spawnError.message } : {}),
      });
    };

    child.once('error', (error) => finish({ exitCode: null, signal: null, spawnError: error }));
    child.once('close', (exitCode, signal) => finish({ exitCode, signal }));
  });
};

export const parseSingleJsonLine = (result) => {
  if (result.status !== 'completed') {
    throw new Error(`JSON output requires a completed process; received ${result.status}`);
  }

  const lines = result.stdout.trim().split(/\r?\n/u).filter((line) => line.length > 0);
  if (lines.length !== 1) {
    throw new Error(`Expected exactly one JSON line; received ${lines.length}`);
  }

  try {
    return JSON.parse(lines[0]);
  } catch (error) {
    throw new Error(`Invalid JSON output: ${error.message}`, { cause: error });
  }
};
