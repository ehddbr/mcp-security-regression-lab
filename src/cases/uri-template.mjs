import { fileURLToPath } from 'node:url';

import { parseSingleJsonLine, runBoundedProcess } from '../process-supervisor.mjs';
import { getUriCase } from './uri-template-manifest.mjs';

const aliasVersions = Object.freeze({ 'mcp-sdk-1251': '1.25.1', 'mcp-sdk-1252': '1.25.2' });
const workerPath = fileURLToPath(new URL('./uri-template-worker.mjs', import.meta.url));
const advisoryUrl = 'https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff';

const parseDiagnostics = (stderr, caseId) => {
  let ready = false;
  let sdkVersion = null;
  const samples = [];

  for (const line of stderr.trim().split(/\r?\n/u)) {
    if (line.startsWith('READY\t')) {
      const [, readyCaseId, version] = line.split('\t');
      if (readyCaseId === caseId && /^1\.25\.[12]$/u.test(version)) {
        ready = true;
        sdkVersion = version;
      }
    } else if (line.startsWith('SAMPLE\t')) {
      try {
        const sample = JSON.parse(line.slice('SAMPLE\t'.length));
        if (
          (sample.size === null || Number.isInteger(sample.size))
          && Number.isFinite(sample.elapsedNs)
          && typeof sample.matched === 'boolean'
        ) {
          samples.push(sample);
        }
      } catch {
        // Malformed diagnostics are ignored and cause the assertion to remain inconclusive.
      }
    }
  }

  return { ready, sdkVersion, samples };
};

export const runUriCase = async ({ sdkAlias, caseId, timeoutMs, processRunner = runBoundedProcess }) => {
  if (!Object.hasOwn(aliasVersions, sdkAlias)) {
    throw new Error(`Unsupported SDK alias: ${sdkAlias}`);
  }
  const selectedCase = getUriCase(caseId);
  if (!selectedCase) {
    throw new Error(`Unsupported URI case: ${caseId}`);
  }

  const processResult = await processRunner({
    command: process.execPath,
    args: [workerPath, sdkAlias, caseId],
    cwd: process.cwd(),
    timeoutMs,
    maxOutputBytes: 64 * 1024,
  });
  const diagnostics = parseDiagnostics(processResult.stderr, caseId);
  const expected = selectedCase.expectedByVersion?.[aliasVersions[sdkAlias]] ?? selectedCase.expected;

  let workerResult = null;
  let processStatus = processResult.status;
  if (processResult.status === 'completed') {
    try {
      const parsed = parseSingleJsonLine(processResult);
      if (!Array.isArray(parsed.samples) || !Number.isFinite(Number(parsed.elapsedNs))) {
        throw new TypeError('Malformed worker result');
      }
      workerResult = parsed;
    } catch {
      processStatus = 'crashed';
    }
  }

  const observed = workerResult
    ? {
        matched: workerResult.matched,
        variables: workerResult.variables,
        elapsedMs: Number(workerResult.elapsedNs) / 1_000_000,
        samples: workerResult.samples.map((sample) => ({
          ...sample,
          elapsedMs: sample.elapsedNs / 1_000_000,
        })),
      }
    : {
        matched: null,
        variables: null,
        elapsedMs: processResult.elapsedMs,
        samples: diagnostics.samples.map((sample) => ({
          ...sample,
          elapsedMs: sample.elapsedNs / 1_000_000,
        })),
      };

  const completedExpectation = expected === 'match'
    ? observed.matched === true
    : expected === 'no_match' && observed.matched === false;
  const expectedSizes = selectedCase.sizes ?? [];
  const completeSeries = expectedSizes.length > 0
    && observed.samples.length === expectedSizes.length
    && observed.samples.every((sample, index) => sample.size === expectedSizes[index] && sample.matched === false);
  const timeoutSeries = expectedSizes.length > 0
    && observed.samples.length === expectedSizes.length - 1
    && observed.samples.every((sample, index) => sample.size === expectedSizes[index] && sample.matched === false)
    && observed.samples.at(-1).elapsedMs >= 20
    && observed.samples.at(-1).elapsedMs >= 2 * observed.samples.at(-2).elapsedMs;
  const slowOrTimeout = expected === 'slow_or_timeout' && (
    (processStatus === 'completed'
      && observed.matched === false
      && completeSeries
      && observed.elapsedMs >= 250)
    || (processStatus === 'timeout' && timeoutSeries)
  );
  const patchedUnderBudget = expected === 'no_match_under_budget'
    && processStatus === 'completed'
    && observed.matched === false
    && completeSeries
    && observed.elapsedMs < 100
    && observed.samples.every((sample) => sample.elapsedMs < 100);
  const passed = diagnostics.ready && diagnostics.sdkVersion === aliasVersions[sdkAlias] && (
    slowOrTimeout
    || patchedUnderBudget
    || (processStatus === 'completed' && completedExpectation)
  );

  return {
    caseId,
    advisoryId: 'CVE-2026-0621',
    sourceUrl: advisoryUrl,
    attribution: 'weblover12',
    packageAlias: sdkAlias,
    sdkVersion: diagnostics.sdkVersion ?? workerResult?.sdkVersion ?? null,
    ready: diagnostics.ready,
    processStatus,
    expected,
    observed,
    passed,
    limitations: ['Timing is an observation on this runtime, not a universal performance guarantee.'],
  };
};
