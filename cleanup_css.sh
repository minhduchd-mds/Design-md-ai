#!/bin/bash

# Delete all .module.css files
rm -f ui/components/*.module.css
rm -f ui/components/*/*.module.css
rm -f web/src/workspace/*.module.css
rm -f ui/styles/tokens.css

echo "✓ Deleted all .module.css files"
echo "✓ Deleted ui/styles/tokens.css"
