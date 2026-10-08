# MCP security regression evidence

Independent validation of previously published fixes; no original discovery or qualification claim.

Generated: 2026-10-08T03:08:22.516Z
Repository: https://github.com/ehddbr/mcp-security-regression-lab
Source commit: 86c30af6babe6c0940e550cbecf31f9de0b53e5b; source tree dirty: false
Runtime: Node v22.23.3, darwin/arm64
Reproduce: `npm ci --ignore-scripts --no-audit --no-fund && npm run evidence`

## Pinned packages

| Alias | Upstream package | Version | Registry integrity |
| --- | --- | --- | --- |
| mcp-sdk-1231 | @modelcontextprotocol/sdk | 1.23.1 | `sha512-JvO6eVMbSKdk+iZcwECz/tra9DRAKlv1mAOsQ1DAWU3qG28tDIffpkEAUkqMMwlOq77GhnMpezEjiQJGIR+hHw==` |
| mcp-sdk-1240 | @modelcontextprotocol/sdk | 1.24.0 | `sha512-D8h5KXY2vHFW8zTuxn2vuZGN0HGrQ5No6LkHwlEA9trVgNdPL3TF1dSqKA7Dny6BbBYKSW/rOBDXdC8KJAjUCg==` |
| mcp-sdk-1251 | @modelcontextprotocol/sdk | 1.25.1 | `sha512-yO28oVFFC7EBoiKdAn+VqRm+plcfv4v0xp6osG/VsCB0NlPZWi87ajbCZZ8f/RvOFLEu7//rSRmuZZ7lMoe3gQ==` |
| mcp-sdk-1252 | @modelcontextprotocol/sdk | 1.25.2 | `sha512-LZFeo4F9M5qOhC/Uc1aQSrBHxMrvxett+9KLHt7OhcExtoiRN9DKgbZffMP/nxjutWDQpfMDfP3nkHI4X9ijww==` |

## Case matrix

| Advisory | Case | SDK version | Input | Expected | Observed | Process | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [CVE-2025-66414](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w) | legacy-disallowed-host | 1.23.1 | host_disallowed_with_port | status_406_marker_1 | HTTP 406; marker 1 | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | ordinary-no-match | 1.25.1 | short_control (12 chars) | no_match | false; 0.103 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | ordinary-no-match | 1.25.2 | short_control (12 chars) | no_match | false; 0.091 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | path-invalid-control | 1.25.1 | short_control (11 chars) | no_match | false; 0.087 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | path-invalid-control | 1.25.2 | short_control (11 chars) | no_match | false; 0.092 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | path-redos | 1.25.1 | comma_segments_trailing_slash (64 chars) | slow_or_timeout | false; 1530.642 ms; 6 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | path-redos | 1.25.2 | comma_segments_trailing_slash (64 chars) | no_match_under_budget | false; 0.008 ms; 6 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | path-valid | 1.25.1 | valid_exploded_path (17 chars) | match | true; 0.141 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | path-valid | 1.25.2 | valid_exploded_path (17 chars) | match | true; 0.102 ms; 1 samples | completed | **pass** |
| [CVE-2025-66414](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w) | protected-disallowed-host | 1.24.0 | host_disallowed_with_port | status_403_marker_0 | HTTP 403; marker 0 | completed | **pass** |
| [CVE-2025-66414](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w) | protected-localhost | 1.24.0 | host_localhost_with_port | status_406_marker_1 | HTTP 406; marker 1 | completed | **pass** |
| [CVE-2025-66414](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w) | protected-loopback-ip | 1.24.0 | host_loopback_ip_with_port | status_406_marker_1 | HTTP 406; marker 1 | completed | **pass** |
| [CVE-2025-66414](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w) | protected-missing-host | 1.24.0 | host_missing | status_400_marker_0 | HTTP 400; marker 0 | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | simple-invalid-control | 1.25.1 | short_control (4 chars) | no_match | false; 0.075 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | simple-invalid-control | 1.25.2 | short_control (4 chars) | no_match | false; 0.072 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | simple-redos | 1.25.1 | comma_segments_trailing_slash (57 chars) | slow_or_timeout | false; 1525.341 ms; 6 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | simple-redos | 1.25.2 | comma_segments_trailing_slash (57 chars) | no_match_under_budget | false; 0.042 ms; 6 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | simple-valid | 1.25.1 | valid_exploded_simple (10 chars) | match | true; 0.077 ms; 1 samples | completed | **pass** |
| [CVE-2026-0621](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-cqwc-fm46-7fff) | simple-valid | 1.25.2 | valid_exploded_simple (10 chars) | match | true; 0.077 ms; 1 samples | completed | **pass** |

## Scope and limitations

- The historical versions isolate two named fixes; no version is certified safe for general use.
- Timings are measured on this runtime and are not universal performance guarantees.
- HTTP requests target ephemeral IPv4 loopback ports only; the Host-header comparison is not a browser exploit.
- The two setups differ in their documented Express construction; upgrading a custom Express app alone does not add this middleware.
- This is a local server-side Host check, not an end-to-end browser DNS-rebinding exploit.
- Timing is an observation on this runtime, not a universal performance guarantee.
- Node HTTP rejects the missing Host header before Express; this case does not prove middleware execution.

Original reports and upstream fixes are credited through each advisory link and the research notes. This project makes no CVE-credit, bounty-standing, accepted-disclosure, adoption, or CVP-approval claim.
