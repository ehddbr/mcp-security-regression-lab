# MCP Security Regression Lab

[![Verification](https://github.com/ehddbr/mcp-security-regression-lab/actions/workflows/verify.yml/badge.svg)](https://github.com/ehddbr/mcp-security-regression-lab/actions/workflows/verify.yml)

Reproducible, local regression tests for two **already published** security fixes in the [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). The project runs real, integrity-pinned historical packages, checks valid and invalid controls, and saves the observed results as [JSON](reports/latest.json) and [Markdown](reports/latest.md). It is maintained by [@ehddbr](https://github.com/ehddbr), with AI-assisted implementation and human-directed validation.

| Boundary | Historical comparison | What the test establishes |
| --- | --- | --- |
| URI-template ReDoS ([CVE-2026-0621](docs/research/CVE-2026-0621.md)) | SDK 1.25.1 → 1.25.2 | A bounded failing exploded-variable input becomes expensive on 1.25.1 and completes quickly on 1.25.2; valid inputs still match. |
| Localhost Host validation ([CVE-2025-66414](docs/research/CVE-2025-66414.md)) | SDK 1.23.1 legacy Express setup → SDK 1.24.0 `createMcpExpressApp()` | A disallowed synthetic Host reaches the legacy MCP route, while the protected app rejects it before the route. Loopback Host controls still reach the route. |

The [upstream advisories](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories) identify the original reporters and fixes. This lab independently checks those changes. It does **not** claim original discovery, a CVE credited to this maintainer, a paid bounty, an accepted disclosure, or safety of a whole SDK version.

The [initial public release commit](https://github.com/ehddbr/mcp-security-regression-lab/commit/97c73b6be9a15da795af34faea69fc5605937da3) passed [GitHub Actions run 37721561500](https://github.com/ehddbr/mcp-security-regression-lab/actions/runs/37721561500) on Node 22 and 24. Its uploaded [Node 22](https://github.com/ehddbr/mcp-security-regression-lab/actions/runs/37721561500/artifacts/11526076598) and [Node 24](https://github.com/ehddbr/mcp-security-regression-lab/actions/runs/37721561500/artifacts/11525896911) evidence each records that exact commit, a clean source tree, and 19 passing cases. Later commits have their own results under the workflow link above.

## Reproduce

Use Node.js 22 or 24. The only HTTP listeners are ephemeral `127.0.0.1` ports owned by this test process; the CLI has no target URL option.

```sh
git clone https://github.com/ehddbr/mcp-security-regression-lab.git
cd mcp-security-regression-lab
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run evidence
```

`npm run check` runs the behavior and failure-mode test suite, then checks all 19 package/version cases. `npm run evidence` writes `reports/latest.json` and `reports/latest.md`. The checked-in report is a local snapshot; each [CI run](https://github.com/ehddbr/mcp-security-regression-lab/actions/workflows/verify.yml) regenerates evidence for its exact commit on Node 22 and 24 and uploads it as an artifact. Timings depend on the runner. A nonzero exit or `fail`/`inconclusive` verdict should be investigated, never presented as a passing result.

To focus a case, run `node src/cli.mjs verify --case path-redos`. The case name must exist in the checked-in manifest. The process supervisor enforces a 2-second deadline and a 64-KiB output cap for regex workers. Historical packages are test inputs, not production recommendations.

## Research and boundaries

- [URI-template test method and patch-reversal check](docs/research/CVE-2026-0621.md)
- [Host-header setup difference and missing-Host limitation](docs/research/CVE-2025-66414.md)
- [Threat model](docs/threat-model.md)
- [Follow-up source review and disclosure status](docs/research/follow-up-review.md)
- [Security reporting](SECURITY.md), [contributing](CONTRIBUTING.md), and [third-party notices](THIRD_PARTY_NOTICES.md)

The code and evidence are provided to help maintainers write stronger regression tests. There is no remote scanner, browser exploit, DNS-rebinding service, npm publication, or live third-party traffic in this release.

## CVP evidence status

This public project documents security engineering work. It does **not**, by itself, establish any of the individual-researcher qualifications currently requested by Anthropic's Cyber Verification Program application: a CVE credited to the applicant, an accepted disclosure/advisory under the applicant's name, verified public bug-bounty standing, or a named security-maintainer role on a project others depend on. Any application must use separately verifiable evidence for one of those criteria. Publication and CI success are not described as CVP acceptance.

Original project code is MIT licensed; see [LICENSE](LICENSE). Upstream SDK code and dependencies retain their own licenses.
