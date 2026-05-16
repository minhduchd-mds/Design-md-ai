#!/bin/bash

# Convert ui/styles/global.css to .scss
cp ui/styles/global.css ui/styles/global.scss
echo "✓ Created ui/styles/global.scss"

# Convert web/src/styles.css to .scss (will do in parts due to size)
cp web/src/styles.css web/src/styles.scss
echo "✓ Created web/src/styles.scss"

# Update imports in all files
sed -i 's|./styles/global\.css|./styles/global.scss|g' ui/main.tsx
sed -i 's|../ui/styles/global\.css|../ui/styles/global.scss|g' .storybook/preview.ts
sed -i "s|'.*ui/styles/global\.css'|'../ui/styles/global.scss'|g" .storybook/preview.ts

echo "✓ Updated imports to reference .scss files"
