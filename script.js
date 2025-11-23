// Pristine Resume Matcher - Keyword Only Version
// Works fully on GitHub Pages (no backend, no API key)

// ---------- DOM ELEMENTS ----------
const jdTextarea = document.getElementById("jobDescription");
const jdFileInput = document.getElementById("jdFile");
const loadJdBtn = document.getElementById("loadJdBtn");

const resumeFilesInput = document.getElementById("resumeFiles");
const processBtn = document.getElementById("processResumesBtn");
const clearBtn = document.getElementById("clearAllBtn");
const statusEl = document.getElementById("uploadStatus");

const resultsBody = document.getElementById("resultsBody");
const exportBtn = document.getElementById("exportCsvBtn");

// (Settings buttons exist in UI but are not used in keyword-only mode)
const openSettingsBtn = document.getElementById("openSettingsBtn");
const openSettingsFromNav = document.getElementById("openSettingsFromNav");

// data store for CSV export
let resultRows = [];

// ---------- HELPERS ----------

// Small log helper
const log = (...args) => console.log("[Pristine Matcher]", ...args);

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// Read text from .txt
async function readTxt(file) {
  return await file.text();
}

// Read text from PDF using pdfjsLib
async function readPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    text += strings.join(" ") + "\n";
  }
  return text.trim();
}

// Read DOCX using mammoth.js
async function readDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

// Normalize text
function cleanText(text) {
  return (text || "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokenization for keyword matching
const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","has","are","was","were",
  "will","your","you","our","we","they","their","but","not","can","may","also",
  "such","a","an","in","on","at","by","of","to","is","it","as","be","or","if"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .slice(0, 1000); // cap to avoid huge lists
}

// Keyword overlap matching
function keywordMatch(jdText, resumeText) {
  const jdTokens = tokenize(jdText);
  const resTokens = tokenize(resumeText);

  const jdSet = new Set(jdTokens);
  const resSet = new Set(resTokens);

  const matched = [...jdSet].filter((w) => resSet.has(w));
  const missing = [...jdSet].filter((w) => !resSet.has(w));

  const score = jdSet.size
    ? Math.round((matched.length / jdSet.size) * 100)
    : 0;

  return { score, matched, missing };
}

// CSV escape
function csvEscape(value) {
  const v = String(value ?? "");
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// Create and download CSV
function downloadCsv(rows) {
  if (!rows.length) {
    alert("No results to export.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const vals = headers.map((h) => csvEscape(row[h]));
    lines.push(vals.join(","));
  }
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pristine_resume_matches.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Escape HTML for safe display
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Open resume text in new window
function openResumeViewer(name, text) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow popups to view full resume.");
    return;
  }
  w.document.write(
    `<html><head><title>${escapeHtml(name)}</title></head><body><pre>` +
      escapeHtml(text) +
      "</pre></body></html>"
  );
  w.document.close();
}

// ---------- EVENT HANDLERS ----------

// Load JD from file
loadJdBtn.addEventListener("click", async () => {
  const file = jdFileInput.files?.[0];
  if (!file) {
    alert("Please choose a JD file (.txt or .pdf).");
    return;
  }
  try {
    setStatus("Reading job description file...");
    let text = "";
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".txt")) {
      text = await readTxt(file);
    } else if (lower.endsWith(".pdf")) {
      text = await readPdf(file);
    } else {
      alert("Unsupported JD file type. Use .txt or .pdf.");
      setStatus("");
      return;
    }
    jdTextarea.value = cleanText(text);
    setStatus("Job description loaded.");
  } catch (err) {
    console.error(err);
    alert("Failed to read JD file.");
    setStatus("Error reading JD file.");
  }
});

// Process resumes & match
processBtn.addEventListener("click", async () => {
  const jdText = jdTextarea.value.trim();
  if (!jdText) {
    alert("Please enter or load a job description first.");
    return;
  }

  const files = Array.from(resumeFilesInput.files || []);
  if (!files.length) {
    alert("Please choose at least one resume file.");
    return;
  }

  setStatus("Reading resumes and extracting text...");
  resultsBody.innerHTML = "";
  resultRows = [];

  const processed = [];

  for (const file of files) {
    try {
      const lower = file.name.toLowerCase();
      let text = "";
      if (lower.endsWith(".txt")) {
        text = await readTxt(file);
      } else if (lower.endsWith(".pdf")) {
        text = await readPdf(file);
      } else if (lower.endsWith(".docx")) {
        text = await readDocx(file);
      } else {
        log("Skipped unsupported file:", file.name);
        continue;
      }
      processed.push({
        name: file.name,
        text: cleanText(text),
      });
    } catch (err) {
      console.error("Error reading resume:", file.name, err);
    }
  }

  if (!processed.length) {
    setStatus("No valid resumes processed.");
    return;
  }

  setStatus(`Matching ${processed.length} resume(s) using keywords...`);

  // Run keyword matching and render
  processed.forEach((res) => {
    const { score, matched, missing } = keywordMatch(jdText, res.text);
    const recommendation =
      score >= 75 ? "Strong fit" : score >= 50 ? "Consider" : "Needs review";

    // Table row
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = res.name;

    const tdScore = document.createElement("td");
    const badge = document.createElement("span");
    badge.textContent = `${score}%`;
    badge.style.fontWeight = "600";
    badge.style.padding = "4px 8px";
    badge.style.borderRadius = "999px";

    if (score >= 75) {
      badge.style.background = "#DCFCE7";
      badge.style.color = "#166534";
    } else if (score >= 50) {
      badge.style.background = "#FEF9C3";
      badge.style.color = "#92400E";
    } else {
      badge.style.background = "#FEE2E2";
      badge.style.color = "#991B1B";
    }
    tdScore.appendChild(badge);

    const tdMatched = document.createElement("td");
    tdMatched.textContent = matched.slice(0, 30).join(", ");

    const tdMissing = document.createElement("td");
    tdMissing.textContent = missing.slice(0, 30).join(", ");

    const tdRec = document.createElement("td");
    tdRec.textContent = recommendation;

    const tdView = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.className = "btn-outline";
    viewBtn.addEventListener("click", () => openResumeViewer(res.name, res.text));
    tdView.appendChild(viewBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    tr.appendChild(tdMatched);
    tr.appendChild(tdMissing);
    tr.appendChild(tdRec);
    tr.appendChild(tdView);

    resultsBody.appendChild(tr);

    // Store for CSV
    resultRows.push({
      Candidate: res.name,
      Score: `${score}%`,
      Matched: matched.join(" | "),
      Missing: missing.join(" | "),
      Recommendation: recommendation,
    });
  });

  exportBtn.disabled = resultRows.length === 0;
  setStatus("Matching completed.");
});

// Clear all
clearBtn.addEventListener("click", () => {
  jdTextarea.value = "";
  jdFileInput.value = "";
  resumeFilesInput.value = "";
  resultsBody.innerHTML = "";
  resultRows = [];
  exportBtn.disabled = true;
  setStatus("");
});

// Export CSV
exportBtn.addEventListener("click", () => {
  downloadCsv(resultRows);
});
