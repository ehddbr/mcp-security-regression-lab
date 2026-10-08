import { performance } from 'node:perf_hooks';

const [caseId] = process.argv.slice(2);
const cases = {
  'path-redos': {
    pattern: '^/users/([^/]+(?:,[^/]+)*)$',
    uri: `/users/${'a,'.repeat(28)}/`,
  },
  'simple-redos': {
    pattern: '^([^/]+(?:,[^/]+)*)$',
    uri: `${'a,'.repeat(28)}/`,
  },
};

const selected = cases[caseId];
if (!selected) {
  process.stderr.write(`Unknown fixture case: ${caseId}\n`);
  process.exit(2);
}

process.stderr.write(`READY\t${caseId}\tfixture-vulnerable\n`);
const startedAt = performance.now();
const match = new RegExp(selected.pattern, 'u').exec(selected.uri);
process.stdout.write(`${JSON.stringify({
  caseId,
  sdkVersion: 'fixture-vulnerable',
  readyAtNs: '0',
  elapsedNs: String(Math.round((performance.now() - startedAt) * 1_000_000)),
  matched: match !== null,
  variables: null,
})}\n`);
