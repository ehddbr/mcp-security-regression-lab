# Contributing

Changes should preserve the project's local-only threat boundary. Add new cases only for published advisories or after coordinated disclosure. Do not add remote targets, arbitrary payload URLs, secret-bearing requests, or unpatched third-party findings to public files.

Use Node 22 or 24, install with `npm ci --ignore-scripts --no-audit --no-fund`, and run `npm run check` before a pull request. Place tests in `test/*.test.mjs`; the test script intentionally excludes executable fixtures in `test/fixtures/`. For a regression case, include a vulnerable version, a patched version, a valid control, a negative control, and a failure-mode check. Document source URLs, attribution, and practical limitations. New evidence fields need schema validation and a privacy check.

Performance thresholds are bounded local observations, not guarantees across machines. If a timing-based test flakes, investigate the worker-ready signal, input shape, and measurement series before changing a threshold. Keep reviews focused on whether the fixture actually distinguishes the published fix.

AI tools assisted the initial implementation. Contributors should review generated code, run the checks, and take responsibility for claims in submissions.
