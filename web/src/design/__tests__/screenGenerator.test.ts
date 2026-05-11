import { describe, expect, it } from "vitest";
import { createEmptyContext } from "../../../../shared/designContext";
import { generateScreens, parseScreensFromMarkdown } from "../screenGenerator";

describe("parseScreensFromMarkdown", () => {
  it("splits generated markdown into screens", () => {
    const screens = parseScreensFromMarkdown(`## Screen: Login

### Components
| Component | Variant | Props |
| Button | Primary | disabled=false |

### Color tokens
- --color-primary

## Screen: Dashboard

### Components
| Component | Variant | Props |
| Card | Default | title=Metrics |
`);

    expect(screens).toHaveLength(2);
    expect(screens[0].components).toContain("Button");
    expect(screens[0].colorTokens).toContain("--color-primary");
  });
});

describe("generateScreens", () => {
  it("returns 5 skeleton screens when API is unavailable", async () => {
    const context = createEmptyContext();
    context.prompt = "Build a dashboard";

    const screens = await generateScreens(context);

    expect(screens).toHaveLength(5);
    expect(screens[0].markdown).toContain("## Screen:");
  });
});
