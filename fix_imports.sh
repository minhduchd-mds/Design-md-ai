#!/bin/bash

# Remove tokens.css imports from ui/main.tsx
sed -i '/import.*tokens\.css/d' ui/main.tsx

# Remove tokens.css imports from .storybook/preview.ts  
sed -i '/import.*tokens\.css/d' .storybook/preview.ts

echo "✓ Removed orphaned tokens.css imports"
