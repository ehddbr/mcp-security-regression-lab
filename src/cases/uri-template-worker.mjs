import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { getUriCase } from './uri-template-manifest.mjs';

const imports = Object.freeze({
  'mcp-sdk-1251': () => import('mcp-sdk-1251/shared/uriTemplate.js'),
  'mcp-sdk-1252': () => import('mcp-sdk-1252/shared/uriTemplate.js'),
});

const [sdkAlias, caseId] = process.argv.slice(2);
const loadSdk = imports[sdkAlias];
const selectedCase = getUriCase(caseId);

if (!loadSdk || !selectedCase) {
  process.stderr.write('Worker received an unsupported SDK alias or case ID\n');
  process.exit(2);
}

const moduleUrl = import.meta.resolve(`${sdkAlias}/shared/uriTemplate.js`);
const packageUrl = new URL('../../../package.json', moduleUrl);
const [{ UriTemplate }, packageDocument] = await Promise.all([
  loadSdk(),
  readFile(packageUrl, 'utf8').then(JSON.parse),
]);

const template = new UriTemplate(selectedCase.template);
const readyAtNs = process.hrtime.bigint();
process.stderr.write(`READY\t${caseId}\t${packageDocument.version}\n`);

const measure = (uri, size = null) => {
  const startedAt = performance.now();
  const variables = template.match(uri);
  const elapsedNs = Math.round((performance.now() - startedAt) * 1_000_000);
  const sample = { size, elapsedNs, matched: variables !== null };
  process.stderr.write(`SAMPLE\t${JSON.stringify(sample)}\n`);
  return { variables, ...sample };
};

let finalSample;
const samples = [];
if (selectedCase.sizes) {
  for (const size of selectedCase.sizes) {
    finalSample = measure(`${selectedCase.prefix}${'a,'.repeat(size)}${selectedCase.suffix}`, size);
    samples.push({ size: finalSample.size, elapsedNs: finalSample.elapsedNs, matched: finalSample.matched });
  }
} else {
  finalSample = measure(selectedCase.uri);
  samples.push({ size: null, elapsedNs: finalSample.elapsedNs, matched: finalSample.matched });
}

process.stdout.write(`${JSON.stringify({
  caseId,
  sdkVersion: packageDocument.version,
  readyAtNs: readyAtNs.toString(),
  elapsedNs: String(finalSample.elapsedNs),
  matched: finalSample.matched,
  variables: finalSample.variables,
  samples,
})}\n`);
