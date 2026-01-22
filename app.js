/***********************
  CONFIG (EDIT THIS)
************************/
const SUPABASE_URL = https://ehnkxlccztcjqznuwtto.supabase.co;
const SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc;

// Telegram (Option B - Unsafe but fast)
const TELEGRAM_BOT_TOKEN = 8510667394:AAHbrRr_4c16sX4kep97ak46mfhJF2cKTNo;
const TELEGRAM_CHAT_ID = "8397321681";

/***********************
  Supabase Client (No library)
************************/
async function supabaseSelectMovies() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/movies?select=*&order=created_at.desc`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  return await res.json();
}

async function supabaseInsertMovie(movie) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/movies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify(movie)
  });
  return await res.json();
}

async function supabaseInsertRequest(req) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify(req)
  });
  return await res.json();
}

/***********************
  Helpers
************************/
function normalizeText(s) {
  return (s || "").toLowerCase().replace(/\s+/g, "").trim();
}

// Simple fuzzy match: checks if query letters mostly appear in name
function fuzzyMatch(name, query) {
  const a = normalizeText(name);
  const b = normalizeText(query);
  if (!b) return true;
  if (a.includes(b)) return true;

  // basic similarity: count matching chars in order
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
  // supports watch?v= and youtu.be/
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

// Modal elements (only if on index)
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
  modalTrailer.src = ""; // stop playing
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
  Request Popup + Telegram
************************/
const requestOverlay = document.getElementById("requestOverlay");
const openRequest = document.getElementById("openRequest");
const closeRequest = document.getElementById("closeRequest");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");
const sendRequestBtn = document.getElementById("sendRequestBtn");

function closeReqPopup(){
  requestOverlay.classList.add("hidden");
}

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
  Admin Page Logic
************************/
async function initAdminPage() {
  const form = document.getElementById("movieForm");
  const adminList = document.getElementById("adminList");

  if (!form) return; // not admin page

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
    const poster_url = document.getElementById("moviePoster").value.trim();
    const trailer_url = document.getElementById("movieTrailer").value.trim();
    const download_url = document.getElementById("movieDownload").value.trim();

    if (!name || !poster_url || !trailer_url || !download_url) {
      alert("All fields required!");
      return;
    }

    try {
      await supabaseInsertMovie({ name, category, poster_url, trailer_url, download_url });
      alert("Movie saved ✅");
      form.reset();
      await refreshAdminList();
    } catch (err) {
      console.log(err);
      alert("Failed to save ❌");
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

    // Search
    if (searchInput) {
      searchInput.addEventListener("input", () => renderMovies());
    }

    // Tabs
    tabs.forEach(t => {
      t.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        activeTab = t.dataset.tab;
        renderMovies();
      });
    });

    // Modal close
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
      const photoUrl = document.getElementById("reqPhotoUrl").value.trim();
      const movieUrl = document.getElementById("reqMovieUrl").value.trim();

      if (!movieName) {
        alert("Movie name required!");
        return;
      }

      try {
        // Save in Supabase
        await supabaseInsertRequest({
          movie_name: movieName,
          photo_url: photoUrl || null,
          movie_url: movieUrl || null,
          user_query: (searchInput?.value || "").trim()
        });

        // Send Telegram
        await sendTelegramRequest({ movieName, photoUrl, movieUrl });

        alert("Request sent ✅");
        closeReqPopup();

        document.getElementById("reqMovieName").value = "";
        document.getElementById("reqPhotoUrl").value = "";
        document.getElementById("reqMovieUrl").value = "";
      } catch (e) {
        console.log(e);
        alert("Failed to send request ❌");
      }
    });
  }

  // Admin init
  await initAdminPage();
});
