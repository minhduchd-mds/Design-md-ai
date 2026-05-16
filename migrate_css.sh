#!/bin/bash

# List of .module.css files to convert
files=(
  "ui/components/AtomicBadge.module.css"
  "ui/components/AutoLayoutFix.module.css"
  "ui/components/BADocumentPanel.module.css"
  "ui/components/BatchPanel.module.css"
  "ui/components/ExportHub.module.css"
  "ui/components/FigmaImportPanel.module.css"
  "ui/components/FixPanel.module.css"
  "ui/components/ProfileEditor.module.css"
  "ui/components/ProfileList.module.css"
  "ui/components/PromptExport.module.css"
  "ui/components/ScanHistory.module.css"
  "ui/components/ScoreOverview.module.css"
  "ui/components/ScreenGenPanel.module.css"
  "ui/components/StandardsChecklist.module.css"
  "ui/components/TokenMap.module.css"
  "ui/components/UiUxEvaluationPanel.module.css"
  "web/src/workspace/HtmlPreviewModal.module.css"
  "web/src/workspace/SplitView.module.css"
)

# Copy CSS to SCSS
for css_file in "${files[@]}"; do
  scss_file="${css_file%.css}.scss"
  cp "$css_file" "$scss_file"
  echo "✓ Created $scss_file"
done

# Update all imports
sed -i 's/\.module\.css";/\.module\.scss";/g' ui/components/*.tsx
sed -i 's/\.module\.css";/\.module\.scss";/g' web/src/workspace/*.tsx

echo "✓ Updated all imports from .module.css to .module.scss"
