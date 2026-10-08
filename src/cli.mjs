import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runHostValidationMatrix } from './cases/host-validation.mjs';
import { URI_CASES } from './cases/uri-template-manifest.mjs';
import { runUriCase } from './cases/uri-template.mjs';
import { buildEvidence, readPinnedPackages, validateEvidence } from './evidence.mjs';
import { runBoundedProcess } from './process-supervisor.mjs';
import { renderMarkdown } from './report.mjs';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const hostCaseIds = new Set([
  'legacy-disallowed-host', 'protected-disallowed-host', 'protected-loopback-ip',
  'protected-localhost', 'protected-missing-host',
]);
const knownCases = new Set([...URI_CASES.map(({ id }) => id), ...hostCaseIds]);

export const parseArguments = (args) => {
  const [command, ...rest] = args;
  if (!['verify', 'evidence'].includes(command)) throw new TypeError('Usage: verify | evidence [--output directory] [--case known-id]');
  let output = 'reports';
  let selectedCase = null;
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag !== '--output' && flag !== '--case') throw new TypeError(`Unknown argument: ${flag}`);
    if (!value) throw new TypeError(`Missing value for ${flag ?? 'argument'}`);
    if (flag === '--output' && command === 'evidence') {
      if (output !== 'reports' || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u.test(value)) throw new TypeError('Invalid output directory');
      output = value;
    } else if (flag === '--case') {
      if (selectedCase !== null || !knownCases.has(value)) throw new TypeError('Unknown or duplicate case');
      selectedCase = value;
    } else {
      throw new TypeError(`Unknown argument: ${flag}`);
    }
  }
  return { command, output, selectedCase };
};

const gitOutput = async (args) => {
  const result = await runBoundedProcess({ command: 'git', args, cwd: repositoryRoot, timeoutMs: 2_000, maxOutputBytes: 64 * 1024 });
  return result.status === 'completed' ? result.stdout.trim() : null;
};

const readRepository = async () => {
  const [commit, status] = await Promise.all([
    gitOutput(['rev-parse', 'HEAD']),
    gitOutput(['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude)reports']),
  ]);
  return {
    url: 'https://github.com/ehddbr/mcp-security-regression-lab',
    commit: /^[0-9a-f]{40}$/u.test(commit ?? '') ? commit : null,
    dirty: status === null ? null : status.length > 0,
  };
};

const gatherEvidence = async (selectedCase) => {
  const selectedUriCases = URI_CASES.filter(({ id }) => selectedCase === null || id === selectedCase);
  const cases = [];
  for (const selected of selectedUriCases) {
    for (const sdkAlias of ['mcp-sdk-1251', 'mcp-sdk-1252']) {
      cases.push(await runUriCase({ sdkAlias, caseId: selected.id, timeoutMs: 2_000 }));
    }
  }
  if (selectedCase === null || hostCaseIds.has(selectedCase)) {
    const hostResults = await runHostValidationMatrix();
    cases.push(...hostResults.filter(({ caseId }) => selectedCase === null || selectedCase === caseId));
  }
  const [repository, packages] = await Promise.all([readRepository(), readPinnedPackages()]);
  return buildEvidence({
    cases,
    repository,
    packages,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    generatedAt: new Date().toISOString(),
  });
};

export const writeEvidenceFiles = async (directory, bundle, markdown, { renameFile = rename } = {}) => {
  validateEvidence(bundle);
  if (markdown !== renderMarkdown(bundle)) {
    throw new TypeError('Invalid Markdown report');
  }
  await mkdir(directory, { recursive: true });
  const suffix = randomUUID();
  const jsonTemp = join(directory, `latest.json.${suffix}.tmp`);
  const markdownTemp = join(directory, `latest.md.${suffix}.tmp`);
  const files = [
    { temporary: jsonTemp, final: join(directory, 'latest.json'), backup: join(directory, `latest.json.${suffix}.bak`), backedUp: false, installed: false },
    { temporary: markdownTemp, final: join(directory, 'latest.md'), backup: join(directory, `latest.md.${suffix}.bak`), backedUp: false, installed: false },
  ];
  let restored = false;
  try {
    await writeFile(jsonTemp, `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await writeFile(markdownTemp, markdown, { flag: 'wx', mode: 0o600 });
    for (const file of files) {
      try {
        await renameFile(file.final, file.backup);
        file.backedUp = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    for (const file of files) {
      await renameFile(file.temporary, file.final);
      file.installed = true;
    }
  } catch (error) {
    try {
      for (const file of files) {
        if (file.installed) await rm(file.final, { force: true });
        if (file.backedUp) await renameFile(file.backup, file.final);
      }
      restored = true;
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], 'Evidence replacement and rollback both failed');
    }
    throw error;
  } finally {
    await Promise.all([rm(jsonTemp, { force: true }), rm(markdownTemp, { force: true })]);
    if (restored || files.every((file) => file.installed)) {
      await Promise.all(files.map((file) => rm(file.backup, { force: true })));
    }
  }
};

export const runCli = async (args, { gather = gatherEvidence, log = console.log } = {}) => {
  let parsed;
  try {
    parsed = parseArguments(args);
  } catch (error) {
    log(error.message);
    return 2;
  }
  let bundle;
  try {
    bundle = await gather(parsed.selectedCase);
    if (parsed.command === 'evidence') {
      const outputDirectory = resolve(repositoryRoot, parsed.output);
      await writeEvidenceFiles(outputDirectory, bundle, renderMarkdown(bundle));
      log(`Evidence written to ${parsed.output}/latest.json and latest.md`);
    }
  } catch (error) {
    log(`Evidence run failed: ${error.message}`);
    return 2;
  }
  const allPassed = bundle.cases.every(({ verdict }) => verdict === 'pass');
  if (parsed.command === 'verify') log(`${bundle.cases.length} cases; ${allPassed ? 'all passed' : 'failed or inconclusive cases present'}`);
  return allPassed ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
