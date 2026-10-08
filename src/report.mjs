import { validateEvidence } from './evidence.mjs';

const cell = (value) => String(value ?? 'unknown').replaceAll('|', '\\|').replaceAll('\n', ' ');
const observation = (item) => {
  if (item.input.shape.startsWith('host_')) {
    return `HTTP ${item.observed.statusCode}; marker ${item.observed.markerCount}`;
  }
  const matched = item.observed.matched === null ? 'unknown' : String(item.observed.matched);
  return `${matched}; ${item.observed.elapsedMs.toFixed(3)} ms; ${item.observed.samples.length} samples`;
};

export const renderMarkdown = (bundle) => {
  validateEvidence(bundle);
  const lines = [
    '# MCP security regression evidence',
    '',
    bundle.disclaimer,
    '',
    `Generated: ${bundle.generatedAt}`,
    `Repository: ${bundle.repository.url}`,
    `Source commit: ${bundle.repository.commit ?? 'unavailable'}; source tree dirty: ${bundle.repository.dirty ?? 'unknown'}`,
    `Runtime: Node ${bundle.runtime.node}, ${bundle.runtime.platform}/${bundle.runtime.arch}`,
    `Reproduce: \`${bundle.reproduction}\``,
    '',
    '## Pinned packages',
    '',
    '| Alias | Upstream package | Version | Registry integrity |',
    '| --- | --- | --- | --- |',
    ...bundle.packages.map((item) => `| ${cell(item.alias)} | ${cell(item.name)} | ${cell(item.version)} | \`${cell(item.integrity)}\` |`),
    '',
    '## Case matrix',
    '',
    '| Advisory | Case | SDK version | Input | Expected | Observed | Process | Verdict |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...bundle.cases.map((item) => `| [${cell(item.advisoryId)}](${item.sourceUrl}) | ${cell(item.caseId)} | ${cell(item.sdkVersion)} | ${cell(item.input.shape)}${item.input.length === undefined ? '' : ` (${item.input.length} chars)`} | ${cell(item.expected)} | ${cell(observation(item))} | ${cell(item.processStatus)} | **${cell(item.verdict)}** |`),
    '',
    '## Scope and limitations',
    '',
    '- The historical versions isolate two named fixes; no version is certified safe for general use.',
    '- Timings are measured on this runtime and are not universal performance guarantees.',
    '- HTTP requests target ephemeral IPv4 loopback ports only; the Host-header comparison is not a browser exploit.',
    ...[...new Set(bundle.cases.flatMap((item) => item.limitations))].map((note) => `- ${note}`),
    '',
    'Original reports and upstream fixes are credited through each advisory link and the research notes. This project makes no CVE-credit, bounty-standing, accepted-disclosure, adoption, or CVP-approval claim.',
    '',
  ];
  return lines.join('\n');
};
