#!/bin/sh
echo "# Third-Party Licenses (SBOM)"
echo ""
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
npx license-checker --production --summary 2>/dev/null || echo "Install license-checker: npm i -g license-checker"
