/**
 * Generates demo/acme-widgets-handbook.docx for RAG upload testing.
 * Run: node scripts/generate-demo-docx.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const buildDir = join(root, "demo", "_docx_build");
const outPath = join(root, "demo", "acme-widgets-handbook.docx");

function esc(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function p(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function h(text, level = 1) {
  const style = level === 1 ? "Heading1" : "Heading2";
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor " +
  "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud " +
  "exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure " +
  "dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

const LOREM2 =
  "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis " +
  "et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. " +
  "Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula.";

const paras = [
  h("Acme Widgets Internal Handbook", 1),
  p(
    "Confidential — For internal use and authorized demo purposes only. This document " +
      "contains placeholder text and specific policy excerpts used to validate document " +
      "retrieval in chat applications.",
  ),
  h("1. Introduction", 1),
  ...Array.from({ length: 3 }, () => [p(LOREM), p(LOREM2)]).flat(),
  h("1.1 Corporate Overview", 2),
  p(
    "Acme Widgets Inc. relocated its global headquarters to Portland, Oregon in March 2024. " +
      "The move consolidated engineering, customer success, and executive leadership under one " +
      "roof at 742 Evergreen Terrace. Public-facing support remains available at " +
      "support@acmewidgets.example, while enterprise customers should use the dedicated channel " +
      "enterprise-support@acmewidgets.example for SLA-backed assistance.",
  ),
  ...Array.from({ length: 2 }, () => p(LOREM)),
  h("2. Product Lines", 1),
  ...Array.from({ length: 4 }, () => p(LOREM)),
  h("2.1 Pro Series Warranty", 2),
  p(
    "All Acme Widgets Pro Series devices ship with a 3-year limited warranty covering " +
      "manufacturing defects and premature motor failure. Extended coverage up to 5 years is " +
      "available through the AcmeCare Plus program (SKU: AW-AC-PLUS-5Y). Warranty claims must " +
      "include the serial number printed on the underside of the unit and proof of purchase " +
      "dated within the last 36 months.",
  ),
  ...Array.from({ length: 2 }, () => p(LOREM2)),
  h("3. Operations", 1),
  ...Array.from({ length: 3 }, () => [p(LOREM), p(LOREM2)]).flat(),
  h("3.1 Returns and Refunds", 2),
  p(
    "Consumer purchases made through the Acme online store may be returned within 30 days of " +
      "delivery for a full refund, provided the item is unused and in original packaging. " +
      "Restocking fees of 15% apply to opened Pro Series units unless the return is due to a " +
      "verified defect. Refunds are processed within 5–7 business days after the warehouse " +
      "receives the return (RMA prefix: AW-RMA-).",
  ),
  ...Array.from({ length: 3 }, () => p(LOREM)),
  h("4. Research & Development", 1),
  p(LOREM),
  p(
    "Internal codename Project Nightingale refers to the silent brushless motor prototype " +
      "developed in Q2 2025 by Dr. Elena Voss and the advanced mechanics team. Nightingale units " +
      "operate below 18 decibels at full load and are scheduled for a limited beta release to " +
      "select Pro Series customers in November 2025. Do not reference Nightingale in external " +
      "marketing materials until the public launch announcement.",
  ),
  ...Array.from({ length: 4 }, () => p(LOREM2)),
  h("5. Pricing Reference (Demo)", 1),
  p(
    "As of July 2025, standard pricing for demo accounts is: Widget Basic (AW-BASIC-001) at " +
      "$49.99, Widget Pro (AW-PRO-002) at $129.99, and the Nightingale upgrade kit (AW-NG-UPG) " +
      "at $79.99 when bundled with a Pro device. Volume discounts start at 50 units for " +
      "enterprise quotes.",
  ),
  ...Array.from({ length: 3 }, () => p(LOREM)),
];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paras.join("\n")}
    <w:sectPr/>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

await mkdir(join(buildDir, "word", "_rels"), { recursive: true });
await mkdir(join(buildDir, "_rels"), { recursive: true });
await writeFile(join(buildDir, "[Content_Types].xml"), contentTypes);
await writeFile(join(buildDir, "_rels", ".rels"), rels);
await writeFile(join(buildDir, "word", "document.xml"), documentXml);
await writeFile(join(buildDir, "word", "_rels", "document.xml.rels"), docRels);

execFileSync("zip", ["-qr", outPath, "."], { cwd: buildDir });
execFileSync("rm", ["-rf", buildDir]);

console.log(`Created ${outPath} (${paras.length} paragraphs)`);
