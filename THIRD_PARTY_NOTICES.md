# Third-party notices

This repository does not relicense upstream projects. The lab installs four aliased historical releases of `@modelcontextprotocol/sdk` (1.23.1, 1.24.0, 1.25.1, 1.25.2) and Express 5.1.0 from npm. Their own package metadata identifies the MIT license; their transitive dependencies retain their individual licenses. Exact archive integrity values are in `package-lock.json` and each generated evidence bundle.

The [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and its upstream security advisories belong to their respective authors and maintainers. The intentionally vulnerable regex in `test/fixtures/vulnerable-uri-template.mjs` is a small test fixture reflecting the previously published pattern, not a claim of original discovery. See the linked advisory and fix in [the URI research note](docs/research/CVE-2026-0621.md).

GitHub Actions used for CI retain their own licenses and are referenced by immutable commits in the workflow.
