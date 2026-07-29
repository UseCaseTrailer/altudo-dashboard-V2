const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

test("browser JavaScript parses", () => {
  assert.ok(scriptMatch, "inline application script should exist");
  assert.doesNotThrow(() => new Function(scriptMatch[1]));
});

test("top-level navigation has one Department control", () => {
  const controls = html.match(/<button class="tab" onclick="switchMain\('dept',this\)">/g) || [];
  assert.equal(controls.length, 1);
});

test("Department navigation uses a left-menu dropdown with a General view", () => {
  assert.match(html, /id="department-nav"/);
  assert.match(html, /id="department-select"/);
  assert.match(html, /General — all departments/);
  assert.match(html, /function selectDepartment\(port\)/);
  assert.match(html, /classList\.toggle\("on",id==="dept"\)/);
});

test("General Department view aggregates live portfolios without duplicate projects", () => {
  assert.match(html, /live\.general=\{/);
  assert.match(html, /name:"General"/);
  assert.match(html, /if\(seen\[identity\]\)return/);
  assert.match(html, /dPortSec = "general"/);
});

test("Department health charts retain complete and unreported projects", () => {
  assert.match(html, /No status \('\+noStatus\+'\)/);
  assert.match(html, /labels:\["On Track","At Risk","Off Track","Complete","No status"\]/);
  assert.match(html, /counts\.gray/);
});

test("theme accessibility layer remaps hard-coded colors", () => {
  assert.match(html, /Theme accessibility layer/);
  assert.match(html, /body\.dark \[style\*="color:#64748b"\]/);
  assert.match(html, /body\.dark \[style\*="background:#f8fafc"\]/);
  assert.match(html, /@media \(forced-colors: active\)/);
});

test("static document IDs are unique", () => {
  const staticMarkup = html.slice(0, html.indexOf("<script>"));
  const ids = [...staticMarkup.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test("dynamic Department panels use portfolio-independent visibility classes", () => {
  assert.match(html, /\.dept-section\s*\{\s*display:\s*none/);
  assert.match(html, /\.dept-section\.on\s*\{\s*display:\s*block/);
  assert.match(html, /class="dept-section dss-/);
  assert.match(html, /Render only the selected report section/);
  assert.match(html, /function switchDeptSec[\s\S]*?renderDept\(\)/);
  assert.doesNotMatch(html, /\.dss-engineering,.dss-sales,.dss-finance,.dss-pm/);
});

test("inactive dashboard sections are not queued as hidden charts", () => {
  assert.match(html, /Render only the active portfolio/);
  assert.match(html, /<div id="ms-'\+mktSec\+'" class="msec on">/);
  assert.match(html, /if\(!el\)return;/);
  assert.doesNotMatch(html, /if\(!el\)\{_pending\[id\]=cfg;return;\}/);
});

test("refresh preserves the current dashboard view", () => {
  assert.match(html, /function applyReportingModel\(model,preferredMain\)/);
  assert.match(html, /applyReportingModel\(payload\.data,requestedMain\)/);
  assert.match(html, /setTab\(targetMain\)/);
});

test("PMO does not render sample reporting during loading or API errors", () => {
  assert.match(html, /if\(DATA_MODE==="loading"\)/);
  assert.match(html, /No sample data is shown in the operational PMO view/);
  assert.match(html, /The PMO view is withheld until a trustworthy live payload is available/);
});

test("marketing filters derive one shared campaign set", () => {
  assert.match(html, /function filterMarketingCampaigns\(\)/);
  assert.match(html, /C=filterMarketingCampaigns\(\)/);
  assert.match(html, /Date range applied across every marketing metric/);
  assert.match(html, /No campaigns in this range/);
});

test("Gentelella adaptation and license attribution are present", () => {
  const notice = fs.readFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(html, /GENTELELLA V4 ADAPTATION/);
  assert.match(notice, /Copyright \(c\) 2014–2026 Aigars Silkalns & Colorlib/);
  assert.match(notice, /The MIT License/);
});
