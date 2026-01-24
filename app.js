/* =========================
   INZO WORLD - app.js
   FULL UPDATED WORKING
========================= */

// ====== SUPABASE (Movies + Upload only) ======
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

// ====== TELEGRAM REQUEST WORKER (Direct) ======
const REQUEST_API_URL = "https://inzoworld-request.dagurvishal2049.workers.dev/";

// ====== UPLOAD PASSCODE SETTINGS ======
const UPLOAD_PASSCODE = "0001";
const MAX_TRIES = 3;

// ====== STORAGE BUCKET ======
const POSTER_BUCKET = "posters";

// ============================
// Helpers
// ============================
function $(id) {
  return document.getElementById(id);
}

function safeText(v) {
  return (v ?? "").toString().trim();
}

function nowISO() {
  return new Date().toISOString();
}

function getDeviceId() {
  // permanent id per device/browser
  let id = localStorage.getItem("inzoworld_device_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : "dev_" + Math.random().toString(16).slice(2);
    localStorage.setItem("inzoworld_device_id", id);
  }
  return id;
}

function getUploadBlockStatus() {
  return localStorage.getItem("inzoworld_upload_blocked") === "1";
}

function setUploadBlocked() {
  localStorage.setItem("inzoworld_upload_blocked", "1");
}

function getTriesLeft() {
  const used = Number(localStorage.getItem("inzoworld_pass_tries_used") || "0");
  return Math.max(0, MAX_TRIES - used);
}

function increaseTryUsed() {
  const used = Number(localStorage.getItem("inzoworld_pass_tries_used") || "0");
  localStorage.setItem("inzoworld_pass_tries_used", String(used + 1));
}

function resetTries() {
  localStorage.setItem("inzoworld_pass_tries_used", "0");
}

function setUploadUnlocked() {
  localStorage.setItem("inzoworld_upload_unlocked", "1");
}

function isUploadUnlocked() {
  return localStorage.getItem("inzoworld_upload_unlocked") === "1";
}

function lockUpload() {
  localStorage.removeItem("inzoworld_upload_unlocked");
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }
  return data;
}

async function supabaseStorageUpload(file, filename) {
  const url = `${SUPABASE_URL}/storage/v1/object/${POSTER_BUCKET}/${filename}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-upsert": "true",
    },
    body: file,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

function supabasePublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${POSTER_BUCKET}/${path}`;
}

// ============================
// UI: Modal + Drawer
// ============================
function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add("show");
  document.body.classList.add("no-scroll");
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("show");
  document.body.classList.remove("no-scroll");
}

function openDrawer() {
  const drawer = $("drawer");
  const overlay = $("drawerOverlay");
  if (drawer) drawer.classList.add("open");
  if (overlay) overlay.classList.add("show");
}

function closeDrawer() {
  const drawer = $("drawer");
  const overlay = $("drawerOverlay");
  if (drawer) drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
}

// ============================
// Movies: Fetch + Render
// ============================
let currentCategory = "bollywood";
let allMovies = [];

function getCategoryLabel(cat) {
  if (cat === "bollywood") return "Bollywood";
  if (cat === "hollywood") return "Hollywood";
  if (cat === "adult") return "18+ Adult";
  return "Movies";
}

function normalizeCategory(cat) {
  const c = safeText(cat).toLowerCase();
  if (c.includes("bolly")) return "bollywood";
  if (c.includes("holly")) return "hollywood";
  if (c.includes("adult") || c.includes("18")) return "adult";
  return "bollywood";
}

async function loadMovies() {
  // Movies table: id, title, category, poster_url, year, created_at
  const data = await supabaseFetch(
    `/rest/v1/movies?select=*&order=created_at.desc`,
    { method: "GET" }
  );

  allMovies = Array.isArray(data) ? data : [];
  renderMovies();
}

function renderMovies() {
  const list = $("movieList");
  const empty = $("emptyState");
  if (!list) return;

  const q = safeText($("searchInput")?.value).toLowerCase();

  const filtered = allMovies.filter((m) => {
    const cat = normalizeCategory(m.category);
    const matchCat = cat === currentCategory;
    const matchSearch = !q || safeText(m.title).toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  list.innerHTML = "";

  if (!filtered.length) {
    if (empty) empty.style.display = "block";
    return;
  } else {
    if (empty) empty.style.display = "none";
  }

  filtered.forEach((m) => {
    const card = document.createElement("div");
    card.className = "movie-card";

    const poster = document.createElement("img");
    poster.className = "movie-poster";
    poster.alt = safeText(m.title) || "Movie";
    poster.loading = "lazy";
    poster.src = m.poster_url || "wallpaper.jpg";

    const info = document.createElement("div");
    info.className = "movie-info";

    const title = document.createElement("div");
    title.className = "movie-title";
    title.textContent = safeText(m.title) || "Untitled";

    const meta = document.createElement("div");
    meta.className = "movie-meta";
    meta.textContent = `${getCategoryLabel(normalizeCategory(m.category))}${m.year ? " • " + m.year : ""}`;

    info.appendChild(title);
    info.appendChild(meta);

    card.appendChild(poster);
    card.appendChild(info);

    card.addEventListener("click", () => {
      // Open movie detail page
      localStorage.setItem("inzoworld_selected_movie", JSON.stringify(m));
      window.location.href = "movie.html";
    });

    list.appendChild(card);
  });
}

// ============================
// Adult Confirm Screen
// ============================
function showAdultConfirm() {
  openModal("adultModal");
}

function hideAdultConfirm() {
  closeModal("adultModal");
}

function isAdultAllowed() {
  return localStorage.getItem("inzoworld_adult_allowed") === "1";
}

function setAdultAllowed() {
  localStorage.setItem("inzoworld_adult_allowed", "1");
}

// ============================
// Request System (Direct Worker)
// ============================
async function sendRequestToTelegram({ movieName, note, posterFile }) {
  const payload = {
    movie: safeText(movieName),
    message: safeText(note),
    url: window.location.origin,
    from: getDeviceId(),
    time: new Date().toLocaleString(),
  };

  // If screenshot/poster file exists => send base64 to worker
  if (posterFile) {
    const base64 = await fileToBase64(posterFile);
    payload.poster_base64 = base64; // Worker will send photo to Telegram
  }

  const res = await fetch(REQUEST_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:image/...;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================
// Upload Movie (Protected by passcode)
// ============================
async function uploadMovieFlow() {
  if (getUploadBlockStatus()) {
    alert("❌ Upload blocked permanently on this device.");
    return;
  }

  if (!isUploadUnlocked()) {
    openModal("passModal");
    return;
  }

  openModal("uploadModal");
}

async function submitUploadMovie() {
  const title = safeText($("uploadTitle")?.value);
  const year = safeText($("uploadYear")?.value);
  const category = safeText($("uploadCategory")?.value || "bollywood");
  const posterFile = $("uploadPoster")?.files?.[0];

  if (!title) {
    alert("Movie name required");
    return;
  }
  if (!posterFile) {
    alert("Poster required");
    return;
  }

  // Upload poster to Supabase Storage
  const filename = `poster_${Date.now()}_${posterFile.name}`.replace(/\s+/g, "_");
  await supabaseStorageUpload(posterFile, filename);
  const poster_url = supabasePublicUrl(filename);

  // Insert movie row
  const movieRow = {
    title,
    year: year ? Number(year) : null,
    category,
    poster_url,
    created_at: nowISO(),
  };

  await supabaseFetch(`/rest/v1/movies`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(movieRow),
  });

  closeModal("uploadModal");
  $("uploadTitle").value = "";
  $("uploadYear").value = "";
  $("uploadPoster").value = "";

  alert("✅ Movie uploaded!");
  await loadMovies();
}

// ============================
// Init + Events
// ============================
function setActiveTab(cat) {
  currentCategory = cat;

  const btnB = $("tabBollywood");
  const btnH = $("tabHollywood");
  const btnA = $("tabAdult");

  [btnB, btnH, btnA].forEach((b) => b && b.classList.remove("active"));

  if (cat === "bollywood" && btnB) btnB.classList.add("active");
  if (cat === "hollywood" && btnH) btnH.classList.add("active");
  if (cat === "adult" && btnA) btnA.classList.add("active");

  renderMovies();
}

function initHeader() {
  // Menu button (header)
  $("menuBtn")?.addEventListener("click", () => {
    openDrawer();
  });

  // Drawer close
  $("drawerClose")?.addEventListener("click", closeDrawer);
  $("drawerOverlay")?.addEventListener("click", closeDrawer);

  // Search input
  $("searchInput")?.addEventListener("input", renderMovies);
}

function initTabs() {
  $("tabBollywood")?.addEventListener("click", () => setActiveTab("bollywood"));
  $("tabHollywood")?.addEventListener("click", () => setActiveTab("hollywood"));

  $("tabAdult")?.addEventListener("click", () => {
    if (!isAdultAllowed()) {
      showAdultConfirm();
      return;
    }
    setActiveTab("adult");
  });

  // Adult confirm buttons
  $("adultYes")?.addEventListener("click", () => {
    setAdultAllowed();
    hideAdultConfirm();
    setActiveTab("adult");
  });

  $("adultNo")?.addEventListener("click", () => {
    hideAdultConfirm();
  });
}

function initDrawerMenu() {
  // Drawer options: Bollywood / Hollywood / 18+ / Movies List / Request / Upload
  $("menuBollywood")?.addEventListener("click", () => {
    closeDrawer();
    setActiveTab("bollywood");
  });

  $("menuHollywood")?.addEventListener("click", () => {
    closeDrawer();
    setActiveTab("hollywood");
  });

  $("menuAdult")?.addEventListener("click", () => {
    closeDrawer();
    if (!isAdultAllowed()) {
      showAdultConfirm();
      return;
    }
    setActiveTab("adult");
  });

  $("menuRequest")?.addEventListener("click", () => {
    closeDrawer();
    openModal("requestModal");
  });

  $("menuUpload")?.addEventListener("click", async () => {
    closeDrawer();
    await uploadMovieFlow();
  });
}

function initRequestModal() {
  $("openRequestBtn")?.addEventListener("click", () => openModal("requestModal"));
  $("requestClose")?.addEventListener("click", () => closeModal("requestModal"));
  $("requestCancel")?.addEventListener("click", () => closeModal("requestModal"));

  $("sendRequest")?.addEventListener("click", async () => {
    try {
      $("sendRequest").disabled = true;
      $("sendRequest").textContent = "Sending...";

      const movieName = safeText($("reqMovie")?.value);
      const note = safeText($("reqNote")?.value);
      const posterFile = $("reqPoster")?.files?.[0] || null;

      if (!movieName) {
        alert("Movie Name required");
        return;
      }

      await sendRequestToTelegram({ movieName, note, posterFile });

      $("reqMovie").value = "";
      $("reqNote").value = "";
      $("reqPoster").value = "";

      closeModal("requestModal");
      alert("✅ Request sent to Telegram!");
    } catch (e) {
      alert("❌ Request failed. Check Worker/Network.");
      console.error(e);
    } finally {
      $("sendRequest").disabled = false;
      $("sendRequest").textContent = "Send Request";
    }
  });
}

function initPasscodeModal() {
  $("passClose")?.addEventListener("click", () => closeModal("passModal"));
  $("passCancel")?.addEventListener("click", () => closeModal("passModal"));

  $("passSubmit")?.addEventListener("click", () => {
    if (getUploadBlockStatus()) {
      alert("❌ Upload blocked permanently on this device.");
      closeModal("passModal");
      return;
    }

    const code = safeText($("passInput")?.value);

    if (!code) {
      alert("Enter passcode");
      return;
    }

    if (code === UPLOAD_PASSCODE) {
      setUploadUnlocked();
      resetTries();
      $("passInput").value = "";
      closeModal("passModal");
      openModal("uploadModal");
      return;
    }

    // wrong
    increaseTryUsed();
    const left = getTriesLeft();

    if (left <= 0) {
      setUploadBlocked();
      closeModal("passModal");
      alert("❌ Upload blocked permanently (3 wrong tries).");
      return;
    }

    alert(`❌ Wrong passcode. Tries left: ${left}`);
  });
}

function initUploadModal() {
  $("uploadClose")?.addEventListener("click", () => closeModal("uploadModal"));
  $("uploadCancel")?.addEventListener("click", () => closeModal("uploadModal"));
  $("uploadSubmit")?.addEventListener("click", async () => {
    try {
      $("uploadSubmit").disabled = true;
      $("uploadSubmit").textContent = "Uploading...";
      await submitUploadMovie();
    } catch (e) {
      console.error(e);
      alert("❌ Upload failed (Storage/RLS). Check policies.");
    } finally {
      $("uploadSubmit").disabled = false;
      $("uploadSubmit").textContent = "Upload Movie";
    }
  });
}

async function init() {
  initHeader();
  initTabs();
  initDrawerMenu();
  initRequestModal();
  initPasscodeModal();
  initUploadModal();

  // Default category
  setActiveTab("bollywood");

  // Load movies
  try {
    await loadMovies();
  } catch (e) {
    console.error(e);
    // Not showing error text in UI (premium look)
  }
}

document.addEventListener("DOMContentLoaded", init);
