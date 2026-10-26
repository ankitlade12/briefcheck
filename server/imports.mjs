import https from "node:https";
import { lookup } from "node:dns/promises";
import { load } from "cheerio";
export function isPublicIPv4(address) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}
export async function publicRequest(
  input,
  { method = "GET", body, headers = {}, redirects = 0 } = {},
) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hostname.endsWith(".local") ||
    url.hostname === "localhost"
  )
    throw new Error("Only public HTTPS URLs on port 443 are supported.");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !isPublicIPv4(a.address)))
    throw new Error(
      "Private, local and reserved network addresses are blocked.",
    );
  const address = addresses[0].address;
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          "User-Agent": "BriefCheck/1.0 (organizer-requested source import)",
          ...headers,
        },
        lookup: (_hostname, options, cb) =>
          options.all
            ? cb(null, [{ address, family: 4 }])
            : cb(null, address, 4),
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          if (redirects >= 3 || method !== "GET")
            return reject(
              new Error(
                "Redirect limit reached or redirect not allowed for an export.",
              ),
            );
          try {
            resolve(
              publicRequest(new URL(res.headers.location, url).href, {
                redirects: redirects + 1,
              }),
            );
          } catch (e) {
            reject(e);
          }
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(
            new Error(
              `Source returned HTTP ${res.statusCode}. Paste permitted text instead.`,
            ),
          );
          return;
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2_000_000) {
            req.destroy();
            reject(new Error("Source exceeds the 2 MB import limit."));
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            bytes: Buffer.concat(chunks),
            contentType: res.headers["content-type"] || "",
            finalUrl: url.href,
          }),
        );
        res.on("error", reject);
      },
    );
    req.setTimeout(12000, () =>
      req.destroy(new Error("Source import timed out.")),
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}
export async function importURL(url) {
  const result = await publicRequest(url);
  if (!/text\/(html|plain)|application\/xhtml/i.test(result.contentType))
    throw new Error(
      "This URL is not an HTML or plain-text page. Use PDF upload for PDFs.",
    );
  let text, title;
  if (/html/.test(result.contentType)) {
    const $ = load(result.bytes.toString("utf8"));
    title = $("title").text().trim();
    $("script,style,nav,footer,header,noscript,svg,iframe,form").remove();
    $("br").replaceWith("\n");
    $("p,li,h1,h2,h3,h4,tr,section,article,div").append("\n");
    text = ($("main").length ? $("main") : $("body"))
      .text()
      .replace(/[\t ]+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();
  } else {
    text = result.bytes.toString("utf8");
    title = new URL(result.finalUrl).hostname;
  }
  if (!text.trim())
    throw new Error(
      "No readable text found. Paste the source manually; scripted pages are not supported.",
    );
  if (text.length > 40000)
    throw new Error(
      "Extracted text exceeds 40,000 characters. Paste the relevant sections; import did not truncate.",
    );
  return {
    title: title?.slice(0, 200) || "Imported page",
    text,
    url: result.finalUrl,
    inputMethod: "url",
    provenance: {
      requestedUrl: url,
      finalUrl: result.finalUrl,
      retrievedAt: new Date().toISOString(),
      warnings: [
        "Public page fetched; navigation removed. Inspect extracted text against the original before reviewing.",
      ],
    },
  };
}
export async function importPDF(bytes, name) {
  if (bytes.length > 2_000_000 || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Upload a text PDF under 2 MB.");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const timeout = setTimeout(() => task.destroy(), 15000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error("The PDF limit is 30 pages.");
    let text = "";
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const p = content.items
        .map((x) => x.str + (x.hasEOL ? "\n" : " "))
        .join("")
        .trim();
      const start = text.length;
      text += `Page ${i}\n${p}\n\n`;
      pages.push({ page: i, start, end: text.length, empty: !p });
      if (text.length > 40000)
        throw new Error("Extracted PDF exceeds 40,000 characters.");
    }
    if (pages.every((p) => p.empty))
      throw new Error(
        "No text layer found. Scanned PDFs and OCR are not supported.",
      );
    return {
      title: name.slice(0, 200),
      text,
      inputMethod: "pdf",
      provenance: {
        importedAt: new Date().toISOString(),
        pages,
        warnings: [
          "Text layout may differ from the PDF. Check page references and reading order.",
          ...pages
            .filter((p) => p.empty)
            .map((p) => `Page ${p.page} has no extracted text.`),
        ],
      },
    };
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}
