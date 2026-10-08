import { buildEvidence } from '../../src/evidence.mjs';

export const rawCase = {
  caseId: 'path-valid', advisoryId: 'CVE-2026-0621',
  sourceUrl: 'https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff',
  attribution: 'weblover12', packageAlias: 'mcp-sdk-1252', sdkVersion: '1.25.2',
  ready: true, processStatus: 'completed', expected: 'match',
  observed: { matched: true, variables: { id: ['alpha', 'beta'] }, elapsedMs: 0.1, samples: [{ size: null, elapsedNs: 100000, matched: true, elapsedMs: 0.1 }] },
  passed: true, limitations: ['Bounded local observation.'],
};

export const makeBundle = (cases = [rawCase]) => buildEvidence({
  cases,
  repository: { url: 'https://github.com/ehddbr/mcp-security-regression-lab', commit: 'a'.repeat(40), dirty: false },
  packages: [{ alias: 'mcp-sdk-1252', name: '@modelcontextprotocol/sdk', version: '1.25.2', integrity: 'sha512-' + 'A'.repeat(86) + '==' }],
  runtime: { node: 'v22.0.0', platform: 'darwin', arch: 'arm64' },
  generatedAt: '2026-10-08T00:00:00.000Z',
});
