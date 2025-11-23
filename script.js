// Pristine Resume Matcher - Keyword + OCR + Themes + Roles + Chatbot + Rich JD Editor

// ---------- ELEMENTS ----------
const jdEditor = document.getElementById("jobDescription");
const jdFileInput = document.getElementById("jdFile");
const loadJdBtn = document.getElementById("loadJdBtn");
const jdClearBtn = document.getElementById("jdClearBtn");
const jdToolbarButtons = document.querySelectorAll(".jd-btn");

const resumeFilesInput = document.getElementById("resumeFiles");
const processBtn = document.getElementById("processResumesBtn");
const clearBtn = document.getElementById("clearAllBtn");
const statusEl = document.getElementById("uploadStatus");

const resultsBody = document.getElementById("resultsBody");
const exportBtn = document.getElementById("exportCsvBtn");
const exportShortBtn = document.getElementById("exportShortlistedBtn");
const resultsTitle = document.getElementById("resultsTitle");

const navUpload = document.getElementById("navUpload");
const navShortlisted = document.getElementById("navShortlisted");
const navSettings = document.getElementById("navSettings");
const navHelp = document.getElementById("navHelp");

const loginOverlay = document.getElementById("loginOverlay");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const currentUserInfo = document.getElementById("currentUserInfo");
const userSelect = document.getElementById("userSelect");

const settingsModal = document.getElementById("settingsModal");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const settingsCloseFooterBtn = document.getElementById("settingsCloseFooterBtn");
const openSettingsBtn = document.getElementById("openSettingsBtn");

const tabTheme = document.getElementById("tabTheme");
const tabUsers = document.getElementById("tabUsers");
const themePanel = document.getElementById("themePanel");
const usersPanel = document.getElementById("usersPanel");
const applyThemeBtn = document.getElementById("applyThemeBtn");

const userMgmtInfo = document.getElementById("userMgmtInfo");
const userMgmtContent = document.getElementById("userMgmtContent");
const userTableBody = document.getElementById("userTableBody");
const editUserIndex = document.getElementById("editUserIndex");
const userNameInput = document.getElementById("userName");
const userEmailInput = document.getElementById("userEmail");
const userPasswordInput = document.getElementById("userPassword");
const userRoleSelect = document.getElementById("userRole");
const saveUserBtn = document.getElementById("saveUserBtn");

const helpPanel = document.getElementById("helpPanel");
const helpChat = document.getElementById("helpChat");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const helpInput = document.getElementById("helpInput");
const helpSendBtn = document.getElementById("helpSendBtn");
const helpQuickButtons = document.querySelectorAll(".help-q");

// ---------- STATE ----------
let allResults = [];
let currentView = "all";
let users = [];
let currentUser = null;

// ---------- UTILITIES ----------
const log = (...args) => console.log("[Pristine Matcher]", ...args);

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function setActiveNav(id) {
  [navUpload, navShortlisted, navSettings, navHelp].forEach((el) => {
    if (!el) return;
    if (el.id === id) el.classList.add("active");
    else el.classList.remove("active");
  });
}

function cleanText(text) {
  return (text || "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// JD helpers (rich editor)
function getJdText() {
  return jdEditor.innerText.trim();
}
function setJdText(text) {
  jdEditor.innerText = text || "";
}

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","have","has","are","was","were","will",
  "your","you","our","we","they","their","but","not","can","may","also","such",
  "a","an","in","on","at","by","of","to","is","it","as","be","or","if"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
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

function csvEscape(value) {
  const v = String(value ?? "");
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function downloadCsv(rows, filename) {
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
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

// ---------- FILE READING ----------
async function readTxt(file) {
  return await file.text();
}

async function readPdfText(file) {
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

async function ocrImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target.result;
        const result = await Tesseract.recognize(dataUrl, "eng");
        resolve(result.data.text || "");
      } catch (err) {
        console.error("OCR error:", err);
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function ocrFirstPageOfPdf(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const result = await Tesseract.recognize(dataUrl, "eng");
    return result.data.text || "";
  } catch (err) {
    console.error("OCR PDF error:", err);
    return "";
  }
}

async function extractResumeText(file) {
  const name = file.name.toLowerCase();
  const type = file.type || "";

  if (type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(name)) {
    return cleanText(await ocrImageFile(file));
  }

  if (name.endsWith(".txt")) {
    return cleanText(await readTxt(file));
  }

  if (name.endsWith(".docx")) {
    return cleanText(await readDocx(file));
  }

  if (name.endsWith(".pdf")) {
    let text = "";
    try {
      text = await readPdfText(file);
    } catch (e) {
      console.warn("PDF text extraction failed, trying OCR:", e);
    }
    if (!text || text.length < 40) {
      const ocrText = await ocrFirstPageOfPdf(file);
      return cleanText(ocrText || text);
    }
    return cleanText(text);
  }

  return "";
}

// ---------- RENDERING RESULTS ----------
function renderResults(viewMode = "all") {
  currentView = viewMode;
  resultsBody.innerHTML = "";

  let filtered = allResults;
  if (viewMode === "shortlisted") {
    filtered = allResults.filter((r) => r.shortlisted);
    resultsTitle.textContent = "Results (Shortlisted Candidates)";
  } else {
    resultsTitle.textContent = "Results (All Candidates)";
  }

  if (!filtered.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent =
      viewMode === "shortlisted"
        ? "No shortlisted candidates yet."
        : "No results yet. Upload resumes and run matching.";
    tr.appendChild(td);
    resultsBody.appendChild(tr);
    exportBtn.disabled = true;
    exportShortBtn.disabled = true;
    return;
  }

  const allCsvRows = [];
  const shortCsvRows = [];

  filtered.forEach((res) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = res.candidate;

    const tdScore = document.createElement("td");
    const badge = document.createElement("span");
    badge.textContent = `${res.score}%`;
    badge.style.fontWeight = "600";
    badge.style.padding = "4px 8px";
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

    const tdMatched = document.createElement("td");
    const matchedList = document.createElement("ul");
    res.matched.slice(0, 8).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      matchedList.appendChild(li);
    });
    tdMatched.appendChild(matchedList);

    const tdMissing = document.createElement("td");
    const missingList = document.createElement("ul");
    res.missing.slice(0, 8).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      missingList.appendChild(li);
    });
    tdMissing.appendChild(missingList);

    const viewAllBtn = document.createElement("button");
    viewAllBtn.textContent = "View all";
    viewAllBtn.className = "btn-outline btn-small";
    viewAllBtn.style.marginTop = "6px";
    viewAllBtn.addEventListener("click", () => {
      alert(
        "Matched Keywords:\n" +
          res.matched.join(", ") +
          "\n\nMissing Keywords:\n" +
          res.missing.join(", ")
      );
    });
    tdMissing.appendChild(viewAllBtn);

    const tdRec = document.createElement("td");
    tdRec.textContent = res.recommendation;

    const tdActions = document.createElement("td");
    tdActions.className = "actions";

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.className = "btn-outline btn-small";
    viewBtn.addEventListener("click", () =>
      openResumeViewer(res.candidate, res.resumeText)
    );

    const shortlistBtn = document.createElement("button");
    shortlistBtn.textContent = res.shortlisted ? "Unshortlist" : "Shortlist";
    shortlistBtn.className = "btn-small";
    shortlistBtn.style.background = res.shortlisted ? "#4b5563" : "#c7ac2a";
    shortlistBtn.style.color = "white";
    shortlistBtn.addEventListener("click", () => {
      res.shortlisted = !res.shortlisted;
      renderResults(currentView);
    });

    if (currentUser && currentUser.role === "viewer") {
      shortlistBtn.disabled = true;
    }

    tdActions.appendChild(viewBtn);
    tdActions.appendChild(shortlistBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    tr.appendChild(tdMatched);
    tr.appendChild(tdMissing);
    tr.appendChild(tdRec);
    tr.appendChild(tdActions);
    resultsBody.appendChild(tr);

    allCsvRows.push({
      Candidate: res.candidate,
      Score: `${res.score}%`,
      Matched: res.matched.join(" | "),
      Missing: res.missing.join(" | "),
      Recommendation: res.recommendation,
      Shortlisted: res.shortlisted ? "Yes" : "No",
    });

    if (res.shortlisted) {
      shortCsvRows.push({
        Candidate: res.candidate,
        Score: `${res.score}%`,
        Matched: res.matched.join(" | "),
        Missing: res.missing.join(" | "),
        Recommendation: res.recommendation,
        Shortlisted: "Yes",
      });
    }
  });

  exportBtn.disabled = !allCsvRows.length;
  exportShortBtn.disabled = !shortCsvRows.length;

  exportBtn.onclick = () =>
    downloadCsv(allCsvRows, "pristine_resume_matches_all.csv");
  exportShortBtn.onclick = () =>
    downloadCsv(shortCsvRows, "pristine_resume_shortlisted.csv");
}

// ---------- LOGIN & USERS ----------
let usersRaw = null;

function loadUsers() {
  const raw = localStorage.getItem("pristine_users");
  if (raw) {
    try {
      users = JSON.parse(raw);
    } catch {
      users = [];
    }
  } else {
    users = [];
  }

  if (!users.length) {
    users.push({
      name: "Praveen",
      email: "praveen@pristine.com",
      password: "admin123",
      role: "admin",
    });
    saveUsers();
  }
}

function saveUsers() {
  localStorage.setItem("pristine_users", JSON.stringify(users));
}

function updateUserSelect() {
  userSelect.innerHTML = "";
  users.forEach((u, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${u.name} (${u.role})`;
    userSelect.appendChild(opt);
  });

  if (currentUser) {
    const index = users.findIndex(
      (u) => u.email === currentUser.email && u.role === currentUser.role
    );
    if (index >= 0) userSelect.value = String(index);
  }
}

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem("pristine_current_user", JSON.stringify(user));
  currentUserInfo.textContent = `Logged in as ${user.name} (${user.role})`;

  const uploadsDisabled = user.role === "viewer";
  resumeFilesInput.disabled = uploadsDisabled;
  processBtn.disabled = uploadsDisabled;
  clearBtn.disabled = uploadsDisabled;

  // Full-screen login: hide login, show app
  document.body.classList.remove("logged-out");
  document.body.classList.add("logged-in");
  loginOverlay.style.display = "none";
}

function initCurrentUser() {
  const raw = localStorage.getItem("pristine_current_user");
  if (raw) {
    try {
      const u = JSON.parse(raw);
      const exist = users.find(
        (x) => x.email === u.email && x.password === u.password
      );
      if (exist) {
        setCurrentUser(exist);
        return;
      }
    } catch {
      // ignore
    }
  }
  // Show login only
  document.body.classList.add("logged-out");
  loginOverlay.style.display = "flex";
}

loginBtn.addEventListener("click", () => {
  const email = loginEmail.value.trim().toLowerCase();
  const pwd = loginPassword.value.trim();
  const found = users.find(
    (u) => u.email.toLowerCase() === email && u.password === pwd
  );
  if (!found) {
    loginError.textContent = "Invalid email or password.";
    return;
  }
  loginError.textContent = "";
  setCurrentUser(found);
  updateUserSelect();
});

userSelect.addEventListener("change", () => {
  const idx = Number(userSelect.value);
  if (!isNaN(idx) && users[idx]) {
    setCurrentUser(users[idx]);
  }
});

// ---------- THEME ----------
function applyTheme(theme) {
  const body = document.body;
  body.classList.remove("theme-light", "theme-dark", "theme-gold");
  if (theme === "light") body.classList.add("theme-light");
  else if (theme === "dark") body.classList.add("theme-dark");
  else body.classList.add("theme-gold");
  localStorage.setItem("pristine_theme", theme);
}

function initTheme() {
  const t = localStorage.getItem("pristine_theme") || "gold";
  applyTheme(t);
  const radios = document.querySelectorAll('input[name="theme"]');
  radios.forEach((r) => {
    r.checked = r.value === t;
  });
}

applyThemeBtn.addEventListener("click", () => {
  const selected = document.querySelector('input[name="theme"]:checked');
  const theme = selected ? selected.value : "gold";
  applyTheme(theme);
  alert("Theme applied.");
});

// ---------- USER MANAGEMENT ----------
function renderUserTable() {
  userTableBody.innerHTML = "";
  users.forEach((u, idx) => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdEmail = document.createElement("td");
    const tdRole = document.createElement("td");
    const tdActions = document.createElement("td");

    tdName.textContent = u.name;
    tdEmail.textContent = u.email;
    tdRole.textContent = u.role;

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "btn-small btn-outline";
    editBtn.addEventListener("click", () => {
      editUserIndex.value = String(idx);
      userNameInput.value = u.name;
      userEmailInput.value = u.email;
      userPasswordInput.value = u.password;
      userRoleSelect.value = u.role;
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "btn-small btn-outline";
    delBtn.addEventListener("click", () => {
      if (users.length === 1) {
        alert("Cannot delete the only user.");
        return;
      }
      if (
        currentUser &&
        currentUser.email === u.email &&
        currentUser.role === u.role
      ) {
        alert("You cannot delete the currently logged-in user.");
        return;
      }
      users.splice(idx, 1);
      saveUsers();
      renderUserTable();
      updateUserSelect();
    });

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdRole);
    tr.appendChild(tdActions);
    userTableBody.appendChild(tr);
  });
}

saveUserBtn.addEventListener("click", () => {
  const name = userNameInput.value.trim();
  const email = userEmailInput.value.trim().toLowerCase();
  const pwd = userPasswordInput.value.trim();
  const role = userRoleSelect.value;

  if (!name || !email || !pwd) {
    alert("Name, email and password are required.");
    return;
  }

  const idxStr = editUserIndex.value;
  if (idxStr) {
    const idx = Number(idxStr);
    if (!isNaN(idx) && users[idx]) {
      users[idx] = { name, email, password: pwd, role };
    }
  } else {
    users.push({ name, email, password: pwd, role });
  }

  editUserIndex.value = "";
  userNameInput.value = "";
  userEmailInput.value = "";
  userPasswordInput.value = "";
  userRoleSelect.value = "recruiter";

  saveUsers();
  renderUserTable();
  updateUserSelect();
  alert("User saved.");
});

// Settings modal
function openSettingsModal() {
  settingsModal.classList.remove("hidden");
  showThemeTab();
  if (currentUser && currentUser.role === "admin") {
    userMgmtInfo.textContent =
      "You are an Admin. You can add, edit and remove users.";
    userMgmtContent.classList.remove("hidden");
    renderUserTable();
  } else {
