/**
 * FAQ markdown parser.
 *
 * Expected format:
 *   # Title (optional)
 *   ## Theme 1
 *   ### Question 1
 *   ...answer...
 *   ### Question 2
 *   ...answer...
 *   ## Theme 2
 *   ### Question 3
 *
 * Non-theme H2 like "Table des matières" or "Sommaire" are skipped.
 */

const NON_THEME_H2 = new Set([
  "table des matières",
  "table des matieres",
  "sommaire",
  "introduction",
]);

export interface ParsedFaq {
  toc: string[];
  sectionsByTitle: Record<string, string>;
  sectionsByTheme: Record<string, string[]>; // theme → list of question titles
  themes: string[];
}

export function parseFaq(markdown: string): ParsedFaq {
  const lines = markdown.split("\n");
  const toc: string[] = [];
  const sectionsByTitle: Record<string, string> = {};
  const sectionsByTheme: Record<string, string[]> = {};
  const themes: string[] = [];

  let currentTitle = "";
  let currentContent: string[] = [];
  let currentTheme = "";

  for (const line of lines) {
    const themeMatch = line.match(/^## (.+)/);
    if (themeMatch) {
      if (currentTitle) {
        sectionsByTitle[currentTitle] = currentContent.join("\n");
      }
      const themeRaw = themeMatch[1].trim();
      if (NON_THEME_H2.has(themeRaw.toLowerCase())) {
        // Skip structural H2 (e.g. "Table des matières")
        currentTitle = "";
        currentContent = [];
        continue;
      }
      currentTheme = themeRaw;
      themes.push(currentTheme);
      sectionsByTheme[currentTheme] = [];
      toc.push(`## ${currentTheme}`);
      currentTitle = "";
      currentContent = [];
      continue;
    }

    const questionMatch = line.match(/^### (.+)/);
    if (questionMatch) {
      if (currentTitle) {
        sectionsByTitle[currentTitle] = currentContent.join("\n");
      }
      currentTitle = questionMatch[1].trim();
      if (currentTheme) {
        sectionsByTheme[currentTheme].push(currentTitle);
      }
      toc.push(`  - ${currentTitle}`);
      currentContent = [line];
      continue;
    }

    if (currentTitle) {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sectionsByTitle[currentTitle] = currentContent.join("\n");
  }

  return { toc, sectionsByTitle, sectionsByTheme, themes };
}
