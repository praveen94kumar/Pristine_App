/****************************************
 * Pristine Resume Matcher - Final JS
 ****************************************/

/* ---------- GLOBAL STATE ---------- */
let currentUser = null;
let allResults = [];
let shortlistedResults = [];

/* ---------- ELEMENT HELPERS ---------- */
function $(id) {
  return document.getElementById(id);
}
function setStatus(msg) {
  const el = $("uploadStatus");
  if (el) el.textContent = msg || "";
}

/* ---------- LOGIN LOGIC ---------- */
(function initLogin() {
  // Seed default user if none
  let users = JSON.parse(localStorage.getItem("pristineUsers") || "[]");
  if (!users.length) {
    users = [
      {
        email: "praveen@pristine.com",
        password: "admin123",
        role: "admin",
      },
    ];
    localStorage.setItem("pristineUsers", JSON.stringify(users));
  }

  // Try auto-login
  const stored = localStorage.getItem("pristineCurrentUser");
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      showApp();
      initApp();
      return;
    } catch (e) {
      // ignore
    }
  }

  // Manual login
  const loginBtn = $("loginBtn");
  loginBtn.addEventListener("click", () => {
    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value.trim();

    const found = users.find(
      (u) => u.email.toLowerCase() === email && u.password === password
    );
    if (!found) {
      $("loginError").textContent = "Invalid email or password.";
      return;
    }

    currentUser = found;
    localStorage.setItem("pristineCurrentUser", JSON.stringify(found));
    $("loginError").textContent = "";
    showApp();
    initApp();
  });
})();

function showApp() {
  $("loginOverlay").classList.add("hidden");
  $("appRoot").classList.remove("hidden");
  const info = $("currentUserInfo");
  if (info && currentUser) {
    info.textContent = `Logged in as ${currentUser.email} (${currentUser.role})`;
  }
}

/* ---------- TEXT UTILITIES ---------- */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "are",
  "was", "were", "will", "your", "you", "our", "we", "they", "their", "but",
  "not", "can", "may", "also", "such", "a", "an", "in", "on", "at", "by",
  "of", "to", "is", "it", "as", "be", "or", "if",
]);

function cleanText(text) {
  return (text || "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 1500);
}

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

/* ---------- FILE READING (TXT/PDF/DOCX/IMAGE) ---------- */
async function readTxt(file) {
  return await file.text();
}

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

async function readDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function ocrImage(file) {
  const result = await Tesseract.recognize(file, "eng");
  return result.data.text || "";
}

async function extractResumeText(file) {
  const name = file.name.toLowerCase();
  const type = file.type || "";

  if (name.endsWith(".txt")) return cleanText(await readTxt(file));
  if (name.endsWith(".pdf")) return cleanText(await readPdf(file));
  if (name.endsWith(".docx")) return cleanText(await readDocx(file));
  if (type.startsWith("image/")) return cleanText(await ocrImage(file));

  return "";
}

/* ---------- RENDERING ---------- */
function renderResults(view = "all") {
  const tbody = $("resultsBody");
  tbody.innerHTML = "";

  const data =
    view === "shortlisted" ? shortlistedResults : allResults;

  $("resultsTitle").textContent =
    view === "shortlisted"
      ? "Results (Shortlisted Candidates)"
      : "Results (All Candidates)";

  if (!data.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent =
      view === "shortlisted"
        ? "No shortlisted candidates yet."
        : "No results yet. Upload resumes and run matching.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    $("exportCsvBtn").disabled = true;
    $("exportShortlistedBtn").disabled = !shortlistedResults.length;
    return;
  }

  data.forEach((res) => {
    const tr = document.createElement("tr");

    // Candidate
    const tdName = document.createElement("td");
    tdName.textContent = res.name;

    // Score
    const tdScore = document.createElement("td");
    const badge = document.createElement("span");
    badge.textContent = `${res.score}%`;
    badge.style.fontWeight = "600";
    badge.style.padding = "3px 8px";
    badge.style.borderRadius = "999px";
    if (res.score >= 75) {
      badge.style.background = "#DCFCE7";
      badge.style.color = "#166534";
    } else if (res.score >= 50) {
      badge.style.background = "#FEF9C3";
      badge.style.color = "#92400E";
    } else {
      badge.style.background = "#FEE2E2";
      badge.style.color = "#991B1B";
    }
    tdScore.appendChild(badge);

    // Matched
    const tdMatched = document.createElement("td");
    const mList = document.createElement("ul");
    res.matched.slice(0, 8).forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      mList.appendChild(li);
    });
    tdMatched.appendChild(mList);

    // Missing
    const tdMissing = document.createElement("td");
    const missList = document.createElement("ul");
    res.missing.slice(0, 8).forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      missList.appendChild(li);
    });
    tdMissing.appendChild(missList);

    // Recommendation
    const tdRec = document.createElement("td");
    tdRec.textContent =
      res.score >= 75
        ? "✅ Strong Fit"
        : res.score >= 50
        ? "🟡 Consider"
        : "❌ Needs Review";

    // Actions
    const tdAct = document.createElement("td");
    tdAct.className = "actions";

    const shortlistBtn = document.createElement("button");
    shortlistBtn.className = "btn-small";
    shortlistBtn.textContent = res.shortlisted
      ? "Unshortlist"
      : "Shortlist";
    shortlistBtn.style.background = res.shortlisted
      ? "#4b5563"
      : "#c7ac2a";
    shortlistBtn.style.color = "white";

    shortlistBtn.addEventListener("click", () => {
      res.shortlisted = !res.shortlisted;
      shortlistedResults = allResults.filter((r) => r.shortlisted);
      renderResults(view);
    });

    tdAct.appendChild(shortlistBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    tr.appendChild(tdMatched);
    tr.appendChild(tdMissing);
    tr.appendChild(tdRec);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  });

  $("exportCsvBtn").disabled = !allResults.length;
  $("exportShortlistedBtn").disabled = !shortlistedResults.length;
}

/* ---------- CSV EXPORT ---------- */
function exportCsv(rows, filename) {
  if (!rows.length) return;
  const header = "Candidate,Score,Matched,Missing,Recommendation,Shortlisted\n";
  const body = rows
    .map((r) => {
      const rec =
        r.score >= 75
          ? "Strong Fit"
          : r.score >= 50
          ? "Consider"
          : "Needs Review";
      return [
        r.name,
        `${r.score}%`,
        r.matched.join(" "),
        r.missing.join(" "),
        rec,
        r.shortlisted ? "Yes" : "No",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    })
    .join("\n");

  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- MAIN APP INITIALISATION ---------- */
function initApp() {
  // JD toolbar
  document.querySelectorAll(".jd-toolbar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      $("jobDescription").focus();
      document.execCommand(cmd, false, null);
    });
  });

  // Load JD from file
  $("loadJdBtn").addEventListener("click", async () => {
    const file = $("jdFile").files?.[0];
    if (!file) {
      alert("Please select a JD file (.txt, .pdf or .docx).");
      return;
    }
    setStatus("Reading job description...");
    try {
      let text = "";
      const name = file.name.toLowerCase();
      if (name.endsWith(".txt")) text = await readTxt(file);
      else if (name.endsWith(".pdf")) text = await readPdf(file);
      else if (name.endsWith(".docx")) text = await readDocx(file);
      else {
        alert("Unsupported JD file type. Use .txt, .pdf or .docx.");
        setStatus("");
        return;
      }
      $("jobDescription").innerText = cleanText(text);
      setStatus("Job description loaded.");
    } catch (e) {
      console.error(e);
      alert("Failed to read JD file.");
      setStatus("Error reading JD file.");
    }
  });

  // Clear JD
  $("clearJdBtn").addEventListener("click", () => {
    $("jobDescription").innerHTML = "";
  });

  // Process resumes
  $("processResumesBtn").addEventListener("click", async () => {
    const jdText = $("jobDescription").innerText.trim();
    if (!jdText) {
      alert("Please type or load the job description first.");
      return;
    }

    const files = Array.from($("resumeFiles").files || []);
    if (!files.length) {
      alert("Please upload at least one resume file.");
      return;
    }

    setStatus("Reading resumes (PDF/DOCX/Image may take a bit)...");
    allResults = [];
    shortlistedResults = [];

    for (const file of files) {
      try {
        const text = await extractResumeText(file);
        if (!text || text.length < 20) continue;
        const { score, matched, missing } = keywordMatch(jdText, text);
        allResults.push({
          name: file.name,
          text,
          score,
          matched,
          missing,
          shortlisted: false,
        });
      } catch (e) {
        console.error("Error reading file", file.name, e);
      }
    }

    if (!allResults.length) {
      setStatus("No valid resumes processed.");
      renderResults("all");
      return;
    }

    setStatus(`Processed ${allResults.length} resume(s).`);
    renderResults("all");
  });

  // Clear all
  $("clearAllBtn").addEventListener("click", () => {
    $("jobDescription").innerHTML = "";
    $("jdFile").value = "";
    $("resumeFiles").value = "";
    allResults = [];
    shortlistedResults = [];
    renderResults("all");
    setStatus("");
  });

  // Export buttons
  $("exportCsvBtn").addEventListener("click", () => {
    exportCsv(allResults, "pristine_all_candidates.csv");
  });
  $("exportShortlistedBtn").addEventListener("click", () => {
    exportCsv(
      shortlistedResults,
      "pristine_shortlisted_candidates.csv"
    );
  });

  // Nav
  $("navUpload").addEventListener("click", () => {
    document
      .querySelectorAll(".menu li")
      .forEach((li) => li.classList.remove("active"));
    $("navUpload").classList.add("active");
    renderResults("all");
  });

  $("navShortlisted").addEventListener("click", () => {
    document
      .querySelectorAll(".menu li")
      .forEach((li) => li.classList.remove("active"));
    $("navShortlisted").classList.add("active");
    renderResults("shortlisted");
  });

  $("navSettings").addEventListener("click", () => {
    document
      .querySelectorAll(".menu li")
      .forEach((li) => li.classList.remove("active"));
    $("navSettings").classList.add("active");
    alert(
      "Settings placeholder:\nThis can be extended later for themes, role management, etc."
    );
  });

  $("navHelp").addEventListener("click", () => {
    document
      .querySelectorAll(".menu li")
      .forEach((li) => li.classList.remove("active"));
    $("navHelp").classList.add("active");
    alert(
      "Help:\n1. Login with your email.\n2. Paste or load JD.\n3. Upload resumes (.txt, .pdf, .docx or images).\n4. Click 'Process & Match'.\n5. Shortlist strong candidates and export."
    );
  });

  // Initial
  renderResults("all");
  setStatus("");
}
