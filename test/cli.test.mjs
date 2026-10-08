import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { parseArguments, runCli, writeEvidenceFiles } from '../src/cli.mjs';
import { renderMarkdown } from '../src/report.mjs';
import { makeBundle } from './fixtures/evidence-bundle.mjs';

test('rejects_unknown_arguments_and_case_names', () => {
  assert.throws(() => parseArguments(['verify', '--unsafe']), /unknown|usage/i);
  assert.throws(() => parseArguments(['verify', '--case', 'arbitrary']), /unknown|case/i);
  assert.throws(() => parseArguments(['evidence', '--output', '../escape']), /output/i);
});

test('verify_exits_nonzero_on_failed_or_inconclusive_case', async () => {
  const failed = await runCli(['verify'], { gather: async () => ({ cases: [{ verdict: 'fail' }] }), write: () => {} });
  const inconclusive = await runCli(['verify'], { gather: async () => ({ cases: [{ verdict: 'inconclusive' }] }), write: () => {} });
  assert.equal(failed, 1);
  assert.equal(inconclusive, 1);
});

test('evidence_writes_json_and_markdown_atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-evidence-'));
  try {
    const bundle = makeBundle();
    const report = renderMarkdown(bundle);
    await writeEvidenceFiles(directory, bundle, report);
    assert.deepEqual((await readdir(directory)).sort(), ['latest.json', 'latest.md']);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'latest.json'), 'utf8')), bundle);
    assert.equal(await readFile(join(directory, 'latest.md'), 'utf8'), report);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('evidence_does_not_overwrite_on_validation_failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-evidence-'));
  try {
    await writeFile(join(directory, 'latest.json'), 'original');
    await assert.rejects(writeEvidenceFiles(directory, { ...makeBundle(), secret: '/Users/example/private' }, '# Unsafe'));
    assert.equal(await readFile(join(directory, 'latest.json'), 'utf8'), 'original');
    assert.deepEqual(await readdir(directory), ['latest.json']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('evidence_restores_both_files_if_second_replace_fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-evidence-'));
  try {
    const original = makeBundle();
    await writeEvidenceFiles(directory, original, renderMarkdown(original));
    const revised = structuredClone(original);
    revised.generatedAt = '2026-10-08T01:00:00.000Z';
    let failed = false;
    const renameFile = async (source, target) => {
      if (!failed && source.endsWith('.tmp') && target.endsWith('/latest.md')) {
        failed = true;
        throw new Error('simulated second replacement failure');
      }
      return rename(source, target);
    };
    await assert.rejects(
      writeEvidenceFiles(directory, revised, renderMarkdown(revised), { renameFile }),
      /simulated second replacement failure/,
    );
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'latest.json'), 'utf8')), original);
    assert.equal(await readFile(join(directory, 'latest.md'), 'utf8'), renderMarkdown(original));
    assert.deepEqual((await readdir(directory)).sort(), ['latest.json', 'latest.md']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
