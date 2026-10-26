import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const results = [];
try {
  await page.goto("http://127.0.0.1:5173");
  results.push({
    screen: "materials",
    result: await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze(),
  });
  await page.getByRole("button", { name: "Load sample materials" }).click();
  await page.getByRole("button", { name: "Review instructions" }).click();
  await page
    .getByText("Review complete: 2 findings, 0 unresolved extractions.")
    .waitFor();
  results.push({
    screen: "review",
    result: await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze(),
  });
  const violations = results.flatMap((x) =>
    x.result.violations.map((v) => ({
      screen: x.screen,
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  );
  await writeFile(
    "/tmp/briefcheck-accessibility.json",
    JSON.stringify(violations, null, 2),
  );
  console.log(JSON.stringify(violations, null, 2));
  process.exitCode = violations.length ? 1 : 0;
} finally {
  await browser.close();
}
