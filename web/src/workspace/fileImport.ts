import JSZip from "jszip";

export interface ImportedMarkdownFile {
  name: string;
  content: string;
}

const MARKDOWN_FILE_PATTERN = /\.(md|markdown|txt)$/i;

export async function readMarkdownFiles(files: FileList): Promise<{ markdownFiles: ImportedMarkdownFile[]; zipCount: number }> {
  const selectedFiles = Array.from(files);
  const directMarkdown = selectedFiles.filter((file) => MARKDOWN_FILE_PATTERN.test(file.name));
  const zipFiles = selectedFiles.filter((file) => /\.zip$/i.test(file.name));

  const markdownFiles: ImportedMarkdownFile[] = await Promise.all(
    directMarkdown.map(async (file) => ({
      name: file.name,
      content: await file.text(),
    })),
  );

  for (const zipFile of zipFiles) {
    const archive = await JSZip.loadAsync(zipFile);
    const archiveMarkdown = Object.values(archive.files).filter((entry) => !entry.dir && MARKDOWN_FILE_PATTERN.test(entry.name));
    const extracted = await Promise.all(
      archiveMarkdown.map(async (entry) => ({
        name: `${zipFile.name}/${entry.name}`,
        content: await entry.async("string"),
      })),
    );
    markdownFiles.push(...extracted);
  }

  return { markdownFiles, zipCount: zipFiles.length };
}

export function buildMarkdownPrompt(files: ImportedMarkdownFile[]): string {
  return files.map((file) => `# Source: ${file.name}\n\n${file.content}`).join("\n\n---\n\n");
}
