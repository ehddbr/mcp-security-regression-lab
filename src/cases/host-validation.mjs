import { readFile } from 'node:fs/promises';
import http from 'node:http';

import express from 'express';
import { createMcpExpressApp } from 'mcp-sdk-1240/server/index.js';
import { StreamableHTTPServerTransport as LegacyTransport } from 'mcp-sdk-1231/server/streamableHttp.js';
import { StreamableHTTPServerTransport as ProtectedTransport } from 'mcp-sdk-1240/server/streamableHttp.js';

const sourceUrl = 'https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w';
const packageVersion = async (alias) => {
  const moduleUrl = import.meta.resolve(`${alias}/server/index.js`);
  const document = JSON.parse(await readFile(new URL('../../../package.json', moduleUrl), 'utf8'));
  return document.version;
};

export const withLoopbackServer = async (app, callback) => {
  const server = http.createServer(app);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || address.address !== '127.0.0.1' || !Number.isInteger(address.port)) {
      throw new Error('Server did not bind to an ephemeral IPv4 loopback port');
    }
    return await callback({ server, port: address.port });
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
};

const probe = (port, host) => new Promise((resolve, reject) => {
  let bytes = 0;
  const request = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/probe',
    method: 'GET',
    agent: false,
    setHost: false,
    headers: host === null ? {} : { Host: host.replace('{port}', String(port)) },
    timeout: 1_000,
  }, (response) => {
    response.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 16 * 1024) {
        request.destroy(new Error('Probe response exceeded 16 KiB'));
      }
    });
    response.on('end', () => resolve({ statusCode: response.statusCode, responseBytes: bytes }));
    response.on('error', reject);
  });
  request.on('timeout', () => request.destroy(new Error('Probe timed out')));
  request.on('error', reject);
  request.end();
});

const cases = Object.freeze([
  { caseId: 'legacy-disallowed-host', setup: 'legacy', host: 'probe.invalid:{port}', hostClass: 'disallowed_with_port', expectedStatus: 406, expectedMarkerCount: 1 },
  { caseId: 'protected-disallowed-host', setup: 'protected', host: 'probe.invalid:{port}', hostClass: 'disallowed_with_port', expectedStatus: 403, expectedMarkerCount: 0 },
  { caseId: 'protected-loopback-ip', setup: 'protected', host: '127.0.0.1:{port}', hostClass: 'loopback_ip_with_port', expectedStatus: 406, expectedMarkerCount: 1 },
  { caseId: 'protected-localhost', setup: 'protected', host: 'localhost:{port}', hostClass: 'localhost_with_port', expectedStatus: 406, expectedMarkerCount: 1 },
  { caseId: 'protected-missing-host', setup: 'protected', host: null, hostClass: 'missing', expectedStatus: 400, expectedMarkerCount: 0 },
]);

const runCase = async (selectedCase, versions, probeRequest) => {
  const protectedSetup = selectedCase.setup === 'protected';
  const app = protectedSetup ? createMcpExpressApp({ host: '127.0.0.1' }) : express();
  const transport = protectedSetup
    ? new ProtectedTransport({ sessionIdGenerator: undefined })
    : new LegacyTransport({ sessionIdGenerator: undefined });
  let markerCount = 0;
  app.get('/probe', async (request, response) => {
    markerCount += 1;
    try {
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) response.status(500).end();
    }
  });

  const response = await withLoopbackServer(app, ({ port }) => probeRequest(port, selectedCase.host));
  const observed = {
    statusCode: response.statusCode,
    responseBytes: response.responseBytes,
    markerCount,
    hostClass: selectedCase.hostClass,
  };
  return {
    caseId: selectedCase.caseId,
    advisoryId: 'CVE-2025-66414',
    sourceUrl,
    attribution: 'JLLeitschuh',
    packageAlias: protectedSetup ? 'mcp-sdk-1240' : 'mcp-sdk-1231',
    sdkVersion: protectedSetup ? versions.protected : versions.legacy,
    ready: true,
    processStatus: 'completed',
    expected: `status_${selectedCase.expectedStatus}_marker_${selectedCase.expectedMarkerCount}`,
    observed,
    passed: response.statusCode === selectedCase.expectedStatus
      && markerCount === selectedCase.expectedMarkerCount,
    limitations: [
      'The two setups differ in their documented Express construction; upgrading a custom Express app alone does not add this middleware.',
      'This is a local server-side Host check, not an end-to-end browser DNS-rebinding exploit.',
      ...(selectedCase.host === null ? ['Node HTTP rejects the missing Host header before Express; this case does not prove middleware execution.'] : []),
    ],
  };
};

export const runHostValidationMatrix = async ({ probeRequest = probe } = {}) => {
  const [legacy, protectedVersion] = await Promise.all([
    packageVersion('mcp-sdk-1231'),
    packageVersion('mcp-sdk-1240'),
  ]);
  const versions = { legacy, protected: protectedVersion };
  const results = [];
  for (const selectedCase of cases) {
    try {
      results.push(await runCase(selectedCase, versions, probeRequest));
    } catch {
      const protectedSetup = selectedCase.setup === 'protected';
      results.push({
        caseId: selectedCase.caseId,
        advisoryId: 'CVE-2025-66414',
        sourceUrl,
        attribution: 'JLLeitschuh',
        packageAlias: protectedSetup ? 'mcp-sdk-1240' : 'mcp-sdk-1231',
        sdkVersion: protectedSetup ? versions.protected : versions.legacy,
        ready: false,
        processStatus: 'crashed',
        expected: `status_${selectedCase.expectedStatus}_marker_${selectedCase.expectedMarkerCount}`,
        observed: { statusCode: 0, responseBytes: 0, markerCount: 0, hostClass: selectedCase.hostClass },
        passed: false,
        limitations: ['The local HTTP probe did not complete; status 0 is a sentinel, not an HTTP response.'],
      });
    }
  }
  return results;
};
