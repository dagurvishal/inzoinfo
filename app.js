// ===============================
// INZO WORLD - FULL APP JS
// ===============================

// 🔥 Your Supabase (Public)
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

// Tables
const MOVIES_TABLE = "movies";
const REQUESTS_TABLE = "requests";
const DOWNLOADS_TABLE = "downloads";

// UI State
let allMovies = [];
let filteredMovies = [];
let currentCategory = "bollywood";

// Elements
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const grid = document.getElementById("moviesGrid");
const emptyState = document.getElementById("emptyState");
const activeCategoryPill = document.getElementById("activeCategoryPill");
const searchInput = document.getElementById("searchInput");

// Request modal
const requestModal = document.getElementById("requestModal");
const reqMovieName = document.getElementById("reqMovieName");
const reqNote = document.getElementById("reqNote");
const reqMsg = document.getElementById("reqMsg");
const reqSendBtn = document.getElementById("reqSendBtn");

// ===============================
// Drawer
// ===============================
function toggleDrawer(open) {
  if (open) {
    drawer.classList.add("open");
    overlay.classList.add("open");
  } else {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  }
}

window.toggleDrawer = toggleDrawer;

// ===============================
// Category
// ===============================
function setCategory(cat) {
  currentCategory = cat;
  toggleDrawer(false);

  if (cat === "bollywood") activeCategoryPill.innerText = "BOLLYWOOD";
  if (cat === "hollywood") activeCategoryPill.innerText = "HOLLYWOOD";
  if (cat === "adult") activeCategoryPill.innerText = "ADULT / 18+";

  applyFilters();
}

window.setCategory = setCategory;

// ===============================
// Filters
// ===============================
function applyFilters() {
  const q = (searchInput.value || "").trim().toLowerCase();

  filteredMovies = allMovies
    .filter(m => (m.category || "").toLowerCase() === currentCategory)
    .filter(m => !q || (m.title || "").toLowerCase().includes(q));

  renderMovies();
}

window.applyFilters = applyFilters;

// ===============================
// Render Movies
// ===============================
function renderMovies() {
  grid.innerHTML = "";

  if (!filteredMovies.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  filteredMovies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "poster";
    card.onclick = () => openMovie(movie);

    const img = document.createElement("img");
    img.src = movie.poster_url || "https://via.placeholder.com/500x700?text=Poster";
    img.alt = movie.title || "Movie";

    const title = document.createElement("div");
    title.className = "title";
    title.innerText = movie.title || "Untitled";

    card.appendChild(img);
    card.appendChild(title);
    grid.appendChild(card);
  });
}

// ===============================
// Open Movie (Detail Screen)
// ===============================
function openMovie(movie) {
  // movie.html page
  const url = `movie.html?id=${encodeURIComponent(movie.id)}`;
  window.location.href = url;
}

window.openMovie = openMovie;

// ===============================
// Supabase Fetch Movies
// ===============================
async function fetchMovies() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${MOVIES_TABLE}?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch movies");

    allMovies = await res.json();
    applyFilters();
  } catch (e) {
    console.error(e);
    emptyState.style.display = "block";
    emptyState.innerText = "Error loading movies.";
  }
}

// ===============================
// Request Modal
// ===============================
function openRequestModal() {
  requestModal.classList.add("open");
  reqMsg.innerText = "";
  reqMovieName.value = "";
  reqNote.value = "";
}

function closeRequestModal() {
  requestModal.classList.remove("open");
  reqMsg.innerText = "";
}

window.openRequestModal = openRequestModal;
window.closeRequestModal = closeRequestModal;

// ===============================
// Submit Request (Supabase Insert)
// ===============================
async function submitRequest() {
  const name = (reqMovieName.value || "").trim();
  const note = (reqNote.value || "").trim();

  if (!name) {
    reqMsg.innerText = "Movie name required ❌";
    return;
  }

  reqSendBtn.innerText = "Sending...";
  reqSendBtn.disabled = true;

  try {
    const payload = {
      movie_name: name,
      user_note: note,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${REQUESTS_TABLE}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t);
    }

    reqMsg.innerText = "Request sent successfully ✅";
    reqSendBtn.innerText = "Send Request";
    reqSendBtn.disabled = false;

    setTimeout(() => {
      closeRequestModal();
    }, 900);

  } catch (e) {
    console.error(e);
    reqMsg.innerText = "Failed to send request ❌ (RLS / Network)";
    reqSendBtn.innerText = "Send Request";
    reqSendBtn.disabled = false;
  }
}

window.submitRequest = submitRequest;

// ===============================
// Init
// ===============================
fetchMovies();
setCategory("bollywood");
