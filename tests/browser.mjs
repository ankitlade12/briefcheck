import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: "Load sample materials" }).click();
await page.screenshot({
  path: "/tmp/briefcheck-materials.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Review instructions" }).click();
await page
  .getByText("Review complete: 2 findings, 0 unresolved extractions.")
  .waitFor();
await page
  .getByRole("button", { name: /Where does the time limit land/ })
  .click();
await page.getByRole("button", { name: "180s", exact: true }).click();
await page.getByRole("button", { name: "Save scenario & results" }).click();
await page
  .getByRole("button", { name: "Inspect exact passage" })
  .first()
  .click();
assert.equal(
  await page.locator("dialog mark").textContent(),
  "Demo video must be at most 3 minutes.",
);
await page.getByRole("button", { name: "Close dialog" }).click();
await page.screenshot({ path: "/tmp/briefcheck-review.png", fullPage: true });
await page.getByRole("button", { name: "Edit local draft" }).first().click();
await page.getByLabel("Organizer’s boundary choice").selectOption("exclude");
await page.getByRole("button", { name: "Apply suggested wording" }).click();
await page.getByRole("button", { name: "Save draft revision" }).click();
await page.getByText("Unchecked changes.", { exact: true }).waitFor();
await page.getByRole("button", { name: "Rerun review" }).click();
await page
  .getByText("Review complete: 1 findings, 0 unresolved extractions.")
  .waitFor();
await page.getByRole("button", { name: "Coverage", exact: true }).click();
await page.getByText("resolved", { exact: true }).waitFor();
await page.getByRole("button", { name: "Export review", exact: true }).click();
const downloaded = page.waitForEvent("download");
await page.getByRole("button", { name: "Structured JSON" }).click();
const download = await downloaded;
await download.saveAs("/tmp/briefcheck-browser-export.json");
const data = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile("/tmp/briefcheck-browser-export.json", "utf8"),
);
assert.equal(data.runs.length, 2);
assert.equal(data.revisions.length, 1);
assert.ok(data.runs[1].scenarios[0].rerunOf);
assert.equal(data.runs[1].scenarios[0].outcomes.length, 2);
assert.ok(
  data.runs[1].scenarios[0].outcomes.every((x) =>
    x.result.startsWith("Does not meet"),
  ),
);
await page
  .getByRole("button", { name: "Revision history", exact: true })
  .click();
await page.getByRole("button", { name: "Undo edit", exact: true }).click();
await page.getByText("Unchecked changes.", { exact: true }).waitFor();
await page.route("**/api/reviews/recheck", (route) =>
  route.fulfill({
    status: 504,
    contentType: "application/json",
    body: JSON.stringify({ error: "Test timeout: retry retains your draft." }),
  }),
);
await page.getByRole("button", { name: "Rerun review" }).click();
await page.getByText("Test timeout: retry retains your draft.").waitFor();
assert.equal(
  await page.getByText("Unchecked changes.", { exact: true }).count(),
  1,
);
await page.unroute("**/api/reviews/recheck");
await page.setViewportSize({ width: 390, height: 844 });
await page
  .getByRole("button", { name: "Source materials", exact: true })
  .click();
await page.screenshot({ path: "/tmp/briefcheck-mobile.png", fullPage: true });
assert.equal(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
  true,
);
assert.deepEqual(errors, []);
console.log(
  "Browser flow passed: sources → review → evidence → boundary → edit → rerun → export → undo → failed rerun → mobile.",
);
await browser.close();
