import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { importPDF, importURL } from "../server/imports.mjs";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
try {
  const page = await browser.newPage();
  await page.setContent(
    "<h1>Synthetic event rules</h1><p>Demo video must be under 180 seconds.</p>",
  );
  const bytes = await page.pdf();
  const imported = await importPDF(bytes, "synthetic-rules.pdf");
  assert.ok(imported.text.includes("under 180 seconds"));
  assert.equal(imported.provenance.pages[0].page, 1);
  await assert.rejects(importPDF(Buffer.from("not a PDF"), "bad.pdf"), /PDF/);
  const web = await importURL("https://example.com");
  assert.equal(web.title, "Example Domain");
  assert.ok(web.text.length > 50);
  assert.equal(web.provenance.finalUrl, "https://example.com/");
  console.log(
    "Import checks passed: live HTTPS HTML, generated text PDF, page provenance and invalid-PDF rejection.",
  );
} finally {
  await browser.close();
}
