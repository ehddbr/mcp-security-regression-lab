# Security policy

This repository is a bounded defensive test lab, not a general scanner. Please do not post details of a new, unpatched third-party vulnerability in a public issue or pull request.

For a vulnerability in this repository, use [GitHub private vulnerability reporting](https://github.com/ehddbr/mcp-security-regression-lab/security/advisories/new) when available. Include the affected commit, safe local reproduction, impact, and a suggested fix. If that private reporting route is unavailable, open a public issue requesting a private contact method **without exploit details**.

For a vulnerability in the upstream MCP SDK, follow the [upstream repository's security policy](https://github.com/modelcontextprotocol/typescript-sdk/security/policy) and disclose privately to its maintainers. We will not publish an unpatched third-party candidate as a way to establish reputation.

Only the current `main` branch is maintained here. Historical SDK versions in the tests are deliberately retained to validate fixes; do not deploy them as a result of this repository.
