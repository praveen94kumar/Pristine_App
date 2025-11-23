/***************************************
 * PRISTINE HR - SCRIPT.JS (FINAL)
 ***************************************/

/* ---------- GLOBAL STORAGE ----------- */
let currentUser = null;
let users = JSON.parse(localStorage.getItem("pristineUsers")) || [];
let resumesData = [];
let shortlisted = [];

/* ---------- DEFAULT ADMIN SETUP ----------- */
if (users.length === 0) {
  users = [
    {
      email: "praveen@pristine.com",
      password: "admin123",
      role: "admin"
    }
  ];
  localStorage.setItem("pristineUsers", JSON.stringify(users));
}

/* ---------- LOGIN HANDLER ----------- */
document.getElementById("loginBtn").addEventListener("click", function () {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value.trim();

  const found = users.find(u => u.email === email && u.password === pass);

  if (!found) {
    alert("Invalid email or password.");
    return;
  }

  currentUser = found;
  localStorage.setItem("pristineCurrentUser", JSON.stringify(currentUser));

  document.getElementById("loginOverlay").style.display = "none";
  document.body.classList.remove("logged-out");

  initDashboard();
});

/* Auto-login if stored */
const storedUser = JSON.parse(localStorage.getItem("pristineCurrentUser"));
if (storedUser) {
  currentUser = storedUser;
  document.getElementById("loginOverlay").style.display = "none";
}

/* ---------- DASHBOARD INITIALIZER ----------- */
function initDashboard() {
  document.getElementById("processResumesBtn").addEventListener("click", processResumes);
  document.getElementById("clearAllBtn").addEventListener("click", clearAll);
  document.getElementById("exportCsvBtn").addEventListener("click", exportAllCSV);
  document.getElementById("exportShortlistedBtn").addEventListener("click", exportShortlistedCSV);
}

/* ---------- READ FILES (TXT/PDF/DOCX/IMAGE) ----------- */
async function extractText(file) {
  const ext = file.name.toLowerCase();

  // TXT
  if (ext.endsWith(".txt")) {
    return await file.text();
  }

  // PDF
  if (ext.endsWith(".pdf")) {
    const arr = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(i => i.str).join(" ");
      text += strings + "\n";
    }
    return text.trim();
  }

  // DOCX
  if (ext.endsWith(".docx")) {
    const arr = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arr });
    return result.value;
  }

  // IMAGE (OCR)
  if (file.type.startsWith("image/")) {
    const result = await Tesseract.recognize(file, "eng");
    return result.data.text.trim();
  }

  return "";
}

/* ---------- PROCESS RESUMES ----------- */
async function processResumes() {
  const files = document.getElementById("resumeFiles").files;

  if (!files.length) {
    alert("Upload at least one resume.");
    return;
  }

  resumesData = [];

  for (let f of files) {
    let text = await extractText(f);
    if (text.trim().length > 0) {
      resumesData.push({
        name: f.name,
        text,
        score: 0,
        matched: [],
        missing: []
      });
    }
  }

  if (resumesData.length === 0) {
    alert("No readable resumes found.");
    return;
  }

  matchResumes();
}

/* ---------- MATCHING LOGIC ----------- */
function matchResumes() {
  const jdHTML = document.getElementById("jobDescription").innerHTML;
  const jdText = jdHTML.replace(/<[^>]+>/g, " ").toLowerCase();

  const jdWords = jdText
    .split(/\s+/)
    .filter(w => w.length > 3);

  resumesData = resumesData.map(r => {
    const words = r.text.toLowerCase().split(/\s+/);
    const matched = jdWords.filter(w => words.includes(w));
    const missing = jdWords.filter(w => !words.includes(w));

    const score = Math.round((matched.length / jdWords.length) * 100);

    return { ...r, matched, missing, score };
  });

  renderResults(resumesData, false);
}

/* ---------- RENDER RESULTS ----------- */
function renderResults(data, shortlistedOnly) {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  data.forEach(res => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${res.name}</td>
      <td>${res.score}%</td>
      <td><ul>${res.matched.slice(0, 8).map(w => `<li>${w}</li>`).join("")}</ul></td>
      <td><ul>${res.missing.slice(0, 8).map(w => `<li>${w}</li>`).join("")}</ul></td>
      <td>${res.score >= 70 ? "✅ Strong Fit" : res.score >= 40 ? "🟡 Moderate Fit" : "❌ Weak Fit"}</td>
      <td class="actions">
        <button class="btn shortlistBtn">Shortlist</button>
      </td>
    `;

    tr.querySelector(".shortlistBtn").addEventListener("click", () => {
      shortlisted.push(res);
      document.getElementById("exportShortlistedBtn").disabled = false;
      alert(`${res.name} shortlisted ✅`);
    });

    tbody.appendChild(tr);
  });

  document.getElementById("exportCsvBtn").disabled = false;
}

/* ---------- CLEAR ----------- */
function clearAll() {
  resumesData = [];
  renderResults([], false);
}

/* ---------- EXPORT ALL CSV ----------- */
function exportAllCSV() {
  exportCSV(resumesData, "all_candidates.csv");
}

/* ---------- EXPORT SHORTLISTED CSV ----------- */
function exportShortlistedCSV() {
  exportCSV(shortlisted, "shortlisted_candidates.csv");
}

/* ---------- CSV EXPORT HELPER ----------- */
function exportCSV(rows, filename) {
  if (!rows.length) return;
  const header = "name,score,matched,missing\n";
  const body = rows.map(r =>
    `"${r.name}","${r.score}","${r.matched.join(" ")}","${r.missing.join(" ")}"`
  ).join("\n");

  const blob = new Blob([header + body], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
