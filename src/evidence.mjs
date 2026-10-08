import { readFile } from 'node:fs/promises';

import { URI_CASES } from './cases/uri-template-manifest.mjs';

const packageAliases = ['mcp-sdk-1231', 'mcp-sdk-1240', 'mcp-sdk-1251', 'mcp-sdk-1252'];
const uriCases = new Map(URI_CASES.map((selectedCase) => [selectedCase.id, selectedCase]));
const sensitiveText = /\b(?:authorization|cookie|AWS_SECRET_ACCESS_KEY|PRIVATE_KEY|ACCESS_TOKEN)\b|file:\/\/|(?:^|[\s"'(=`])\/(?!\/)[^\s]+|[A-Za-z]:\\/iu;

const assertKeys = (value, allowed, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`Unknown ${label} field: ${key}`);
  }
};
const assertString = (value, label) => {
  if (typeof value !== 'string' || !value || sensitiveText.test(value)) {
    throw new TypeError(`Invalid or sensitive ${label}`);
  }
};
const assertNumber = (value, label) => {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`Invalid ${label}`);
};

const inputFor = (rawCase) => {
  const uriCase = uriCases.get(rawCase.caseId);
  if (uriCase) {
    const length = uriCase.sizes
      ? uriCase.prefix.length + 2 * uriCase.sizes.at(-1) + uriCase.suffix.length
      : uriCase.uri.length;
    const shape = uriCase.sizes ? 'comma_segments_trailing_slash'
      : uriCase.id === 'path-valid' ? 'valid_exploded_path'
      : uriCase.id === 'simple-valid' ? 'valid_exploded_simple'
      : 'short_control';
    return { shape, length };
  }
  return { shape: `host_${rawCase.observed.hostClass}` };
};

export const readPinnedPackages = async () => {
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  return packageAliases.map((alias) => {
    const entry = lock.packages[`node_modules/${alias}`];
    if (!entry?.version || !entry?.integrity) throw new Error(`Missing pinned package: ${alias}`);
    return { alias, name: '@modelcontextprotocol/sdk', version: entry.version, integrity: entry.integrity };
  });
};

export const buildEvidence = ({ cases, repository, packages, runtime, generatedAt }) => {
  const bundle = {
    schemaVersion: 1,
    generatedAt,
    repository: { url: repository.url, commit: repository.commit, dirty: repository.dirty },
    runtime: { node: runtime.node, platform: runtime.platform, arch: runtime.arch },
    packages: [...packages].sort((a, b) => a.alias.localeCompare(b.alias)),
    cases: cases.map((rawCase) => ({
      caseId: rawCase.caseId,
      advisoryId: rawCase.advisoryId,
      sourceUrl: rawCase.sourceUrl,
      attribution: rawCase.attribution,
      packageAlias: rawCase.packageAlias,
      sdkVersion: rawCase.sdkVersion,
      input: inputFor(rawCase),
      ready: rawCase.ready,
      processStatus: rawCase.processStatus,
      expected: rawCase.expected,
      observed: structuredClone(rawCase.observed),
      verdict: rawCase.passed ? 'pass' : rawCase.processStatus === 'completed' ? 'fail' : 'inconclusive',
      limitations: [...rawCase.limitations],
    })).sort((a, b) => a.caseId.localeCompare(b.caseId) || (a.sdkVersion ?? '').localeCompare(b.sdkVersion ?? '')),
    reproduction: 'npm ci --ignore-scripts --no-audit --no-fund && npm run evidence',
    disclaimer: 'Independent validation of previously published fixes; no original discovery or qualification claim.',
  };
  validateEvidence(bundle);
  return bundle;
};

export const validateEvidence = (bundle) => {
  assertKeys(bundle, ['schemaVersion', 'generatedAt', 'repository', 'runtime', 'packages', 'cases', 'reproduction', 'disclaimer'], 'bundle');
  if (bundle.schemaVersion !== 1) throw new TypeError('Unsupported schemaVersion');
  assertString(bundle.generatedAt, 'generatedAt');
  if (!Number.isFinite(Date.parse(bundle.generatedAt))) throw new TypeError('Invalid generatedAt');
  assertString(bundle.reproduction, 'reproduction');
  assertString(bundle.disclaimer, 'disclaimer');

  assertKeys(bundle.repository, ['url', 'commit', 'dirty'], 'repository');
  assertString(bundle.repository.url, 'repository.url');
  if (!/^https:\/\/github\.com\/ehddbr\/mcp-security-regression-lab$/u.test(bundle.repository.url)) throw new TypeError('Unexpected repository URL');
  if (bundle.repository.commit !== null && !/^[0-9a-f]{40}$/u.test(bundle.repository.commit)) throw new TypeError('Invalid commit');
  if (typeof bundle.repository.dirty !== 'boolean' && bundle.repository.dirty !== null) throw new TypeError('Invalid dirty state');

  assertKeys(bundle.runtime, ['node', 'platform', 'arch'], 'runtime');
  for (const key of ['node', 'platform', 'arch']) assertString(bundle.runtime[key], `runtime.${key}`);
  if (!Array.isArray(bundle.packages) || bundle.packages.length === 0) throw new TypeError('Missing packages');
  for (const item of bundle.packages) {
    assertKeys(item, ['alias', 'name', 'version', 'integrity'], 'package');
    if (!packageAliases.includes(item.alias) || item.name !== '@modelcontextprotocol/sdk') throw new TypeError('Unexpected package');
    assertString(item.version, 'package.version');
    if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(item.integrity)) throw new TypeError('Invalid package integrity');
  }

  if (!Array.isArray(bundle.cases) || bundle.cases.length === 0) throw new TypeError('No cases');
  for (const item of bundle.cases) {
    assertKeys(item, ['caseId', 'advisoryId', 'sourceUrl', 'attribution', 'packageAlias', 'sdkVersion', 'input', 'ready', 'processStatus', 'expected', 'observed', 'verdict', 'limitations'], 'case');
    for (const key of ['caseId', 'advisoryId', 'sourceUrl', 'attribution', 'packageAlias', 'expected']) assertString(item[key], `case.${key}`);
    if (!item.sourceUrl.startsWith('https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/')) throw new TypeError('Unexpected advisory source');
    if (!packageAliases.includes(item.packageAlias)) throw new TypeError('Unexpected case package');
    if (item.sdkVersion !== null) assertString(item.sdkVersion, 'case.sdkVersion');
    if (typeof item.ready !== 'boolean') throw new TypeError('Invalid ready');
    if (!['completed', 'timeout', 'crashed', 'output_limit'].includes(item.processStatus)) throw new TypeError('Invalid processStatus');
    if (!['pass', 'fail', 'inconclusive'].includes(item.verdict)) throw new TypeError('Invalid verdict');
    assertKeys(item.input, ['shape', 'length'], 'input');
    assertString(item.input.shape, 'input.shape');
    if (item.input.length !== undefined) assertNumber(item.input.length, 'input.length');
    if (!Array.isArray(item.limitations)) throw new TypeError('Invalid limitations');
    for (const text of item.limitations) assertString(text, 'limitation');

    if (item.caseId.startsWith('legacy-') || item.caseId.startsWith('protected-')) {
      assertKeys(item.observed, ['statusCode', 'responseBytes', 'markerCount', 'hostClass'], 'host observed');
      for (const key of ['statusCode', 'responseBytes', 'markerCount']) assertNumber(item.observed[key], `observed.${key}`);
      assertString(item.observed.hostClass, 'observed.hostClass');
    } else {
      assertKeys(item.observed, ['matched', 'variables', 'elapsedMs', 'samples'], 'URI observed');
      if (![true, false, null].includes(item.observed.matched)) throw new TypeError('Invalid observed.matched');
      assertNumber(item.observed.elapsedMs, 'observed.elapsedMs');
      if (item.observed.variables !== null) {
        assertKeys(item.observed.variables, ['id'], 'variables');
        if (!Array.isArray(item.observed.variables.id) || item.observed.variables.id.some((value) => typeof value !== 'string' || sensitiveText.test(value))) throw new TypeError('Invalid variables');
      }
      if (!Array.isArray(item.observed.samples)) throw new TypeError('Invalid samples');
      for (const sample of item.observed.samples) {
        assertKeys(sample, ['size', 'elapsedNs', 'matched', 'elapsedMs'], 'sample');
        if (sample.size !== null) assertNumber(sample.size, 'sample.size');
        assertNumber(sample.elapsedNs, 'sample.elapsedNs');
        assertNumber(sample.elapsedMs, 'sample.elapsedMs');
        if (typeof sample.matched !== 'boolean') throw new TypeError('Invalid sample.matched');
      }
    }
  }
};
