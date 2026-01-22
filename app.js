/***********************
  CONFIG (EDIT THIS)
************************/
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

// Telegram (Option B - token visible)
const TELEGRAM_BOT_TOKEN = "8510667394:AAHbrRr_4c16sX4kep97ak46mfhJF2cKTNo";
const TELEGRAM_CHAT_ID = "8397321681";

// Storage buckets
const POSTERS_BUCKET = "posters";
const REQUESTS_BUCKET = "requests"; // create this bucket too (public)

/***********************
  Supabase REST helpers
************************/
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(options.headers || {})
    }
  });

  // try parse json safely
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.log("Supabase error:", res.status, data);
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }

  return data;
}

async function supabaseSelectMovies() {
  return await sbFetch(`/rest/v1/movies?select=*&order=created_at.desc`);
}

async function supabaseInsertMovie(movie) {
  return await sbFetch(`/rest/v1/movies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(movie)
  });
}

async function supabaseInsertRequest(req) {
  return await sbFetch(`/rest/v1/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(req)
  });
}

/***********************
  Storage Upload (Supabase)
************************/
async function uploadToBucket(bucketName, file) {
  const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExt}`;
  const filePath = `${safeName}`;

  // Upload
  await sbFetch(`/storage/v1/object/${bucketName}/${filePath}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  // Public URL
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
  return publicUrl;
}

/***********************
  Helpers
************************/
function normalizeText(s) {
  return (s || "").toLowerCase().replace(/\s+/g, "").trim();
}

// Fuzzy match: typo support
function fuzzyMatch(name, query) {
  const a = normalizeText(name);
  const b = normalizeText(query);
  if (!b) return true;
  if (a.includes(b)) return true;

  let i = 0, j = 0, match = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { match++; j++; }
    i++;
  }
  return match >= Math.max(3, Math.floor(b.length * 0.6));
}

function categoryLabel(cat) {
  if (cat === "ADULT") return "18+";
  return cat;
}

function toYouTubeEmbed(url) {
  if (!url) return "";
  let id = "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.replace("/", "");
    } else {
      id = u.searchParams.get("v") || "";
    }
  } catch (e) {
    return "";
  }
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

/***********************
  Home Page Logic
************************/
let allMovies = [];
let activeTab = "BOLLYWOOD";

const grid = document.getElementById("moviesGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

// Modal elements (index only)
const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const modalTrailer = document.getElementById("modalTrailer");
const watchTrailerBtn = document.getElementById("watchTrailerBtn");
const downloadBtn = document.getElementById("downloadBtn");

// Tabs
const tabs = document.querySelectorAll(".tab");

function renderMovies() {
  if (!grid) return;

  const q = searchInput ? searchInput.value.trim() : "";
  const filtered = allMovies.filter(m => {
    const catOk = m.category === activeTab;
    const searchOk = fuzzyMatch(m.name, q);
    return catOk && searchOk;
  });

  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  } else {
    emptyState.classList.add("hidden");
  }

  filtered.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movieCard";
    card.innerHTML = `
      <img src="${movie.poster_url}" alt="${movie.name}" />
      <div class="movieInfo">
        <div class="movieTitle">${movie.name}</div>
        <div class="badge">${categoryLabel(movie.category)}</div>
      </div>
    `;
    card.addEventListener("click", () => openMovie(movie));
    grid.appendChild(card);
  });
}

function openMovie(movie) {
  modalTitle.textContent = movie.name;
  modalCategory.textContent = categoryLabel(movie.category);

  const embed = toYouTubeEmbed(movie.trailer_url);
  modalTrailer.src = embed;

  watchTrailerBtn.href = movie.trailer_url;
  downloadBtn.href = movie.download_url;

  modalOverlay.classList.remove("hidden");
}

function closeMovieModal() {
  modalOverlay.classList.add("hidden");
  modalTrailer.src = "";
}

async function loadMoviesFromSupabase() {
  try {
    allMovies = await supabaseSelectMovies();
    renderMovies();
  } catch (e) {
    console.log("Error loading movies:", e);
  }
}

/***********************
  Telegram Send
************************/
async function sendTelegramRequest({ movieName, photoUrl, movieUrl }) {
  const text =
`🎬 New Movie Request

📌 Name: ${movieName}
🖼 Photo: ${photoUrl || "Not provided"}
🔗 URL: ${movieUrl || "Not provided"}`;

  const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text
    })
  });

  return await res.json();
}

/***********************
  Request Popup (with photo upload)
************************/
const requestOverlay = document.getElementById("requestOverlay");
const openRequest = document.getElementById("openRequest");
const closeRequest = document.getElementById("closeRequest");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");
const sendRequestBtn = document.getElementById("sendRequestBtn");

function closeReqPopup(){
  requestOverlay.classList.add("hidden");
}

/***********************
  Admin Page Logic (Poster Upload)
************************/
async function initAdminPage() {
  const form = document.getElementById("movieForm");
  const adminList = document.getElementById("adminList");
  const adminStatus = document.getElementById("adminStatus");
  const saveBtn = document.getElementById("saveMovieBtn");

  if (!form) return;

  async function refreshAdminList() {
    const movies = await supabaseSelectMovies();
    adminList.innerHTML = "";
    movies.forEach(m => {
      const row = document.createElement("div");
      row.className = "adminItem";
      row.innerHTML = `
        <img src="${m.poster_url}" alt="${m.name}">
        <div>
          <div style="font-weight:900">${m.name}</div>
          <div style="opacity:0.7;font-size:12px">${categoryLabel(m.category)}</div>
        </div>
      `;
      adminList.appendChild(row);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("movieName").value.trim();
    const category = document.getElementById("movieCategory").value;
    const posterFile = document.getElementById("moviePosterFile").files[0];
    const trailer_url = document.getElementById("movieTrailer").value.trim();
    const download_url = document.getElementById("movieDownload").value.trim();

    if (!name || !posterFile || !trailer_url || !download_url) {
      alert("All fields required!");
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Uploading...";

      adminStatus.textContent = "Uploading poster...";
      const poster_url = await uploadToBucket(POSTERS_BUCKET, posterFile);

      adminStatus.textContent = "Saving movie...";
      await supabaseInsertMovie({ name, category, poster_url, trailer_url, download_url });

      adminStatus.textContent = "Movie saved ✅";
      alert("Movie saved ✅");

      form.reset();
      await refreshAdminList();
    } catch (err) {
      console.log(err);
      adminStatus.textContent = "Failed ❌ (check Supabase policies)";
      alert("Failed to save ❌");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Movie";
    }
  });

  await refreshAdminList();
}

/***********************
  Init
************************/
document.addEventListener("DOMContentLoaded", async () => {
  // Home page init
  if (grid) {
    await loadMoviesFromSupabase();

    if (searchInput) {
      searchInput.addEventListener("input", () => renderMovies());
    }

    tabs.forEach(t => {
      t.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        activeTab = t.dataset.tab;
        renderMovies();
      });
    });

    closeModal.addEventListener("click", closeMovieModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeMovieModal();
    });

    // Request popup
    openRequest.addEventListener("click", () => requestOverlay.classList.remove("hidden"));
    closeRequest.addEventListener("click", closeReqPopup);
    cancelRequestBtn.addEventListener("click", closeReqPopup);

    sendRequestBtn.addEventListener("click", async () => {
      const movieName = document.getElementById("reqMovieName").value.trim();
      const movieUrl = document.getElementById("reqMovieUrl").value.trim();
      const reqFile = document.getElementById("reqPhotoFile").files[0];

      if (!movieName) {
        alert("Movie name required!");
        return;
      }

      try {
        let photoUrl = null;

        if (reqFile) {
          photoUrl = await uploadToBucket(REQUESTS_BUCKET, reqFile);
        }

        // Save request in Supabase
        await supabaseInsertRequest({
          movie_name: movieName,
          photo_url: photoUrl,
          movie_url: movieUrl || null,
          user_query: (searchInput?.value || "").trim()
        });

        // Send Telegram
        await sendTelegramRequest({ movieName, photoUrl, movieUrl });

        alert("Request sent ✅");
        closeReqPopup();

        document.getElementById("reqMovieName").value = "";
        document.getElementById("reqMovieUrl").value = "";
        document.getElementById("reqPhotoFile").value = "";
      } catch (e) {
        console.log(e);
        alert("Failed to send request ❌");
      }
    });
  }

  // Admin init
  await initAdminPage();
});
