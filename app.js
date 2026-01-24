const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI refs
const moviesGrid = document.getElementById("moviesGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const openRequestBtn = document.getElementById("openRequestBtn");
const requestModal = document.getElementById("requestModal");
const closeRequestModal = document.getElementById("closeRequestModal");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");
const requestForm = document.getElementById("requestForm");

const reqMovieName = document.getElementById("reqMovieName");
const reqQuality = document.getElementById("reqQuality");
const reqLanguage = document.getElementById("reqLanguage");
const reqNotes = document.getElementById("reqNotes");
const submitRequestBtn = document.getElementById("submitRequestBtn");

const movieModal = document.getElementById("movieModal");
const closeMovieModal = document.getElementById("closeMovieModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalRequestBtn = document.getElementById("modalRequestBtn");
const modalPoster = document.getElementById("modalPoster");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");

const ageModal = document.getElementById("ageModal");
const ageYes = document.getElementById("ageYes");
const ageNo = document.getElementById("ageNo");

const toast = document.getElementById("toast");

let activeTab = "BOLLYWOOD";
let allMovies = [];
let selectedMovie = null;
let pendingAdultTab = false;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1800);
}

function openModal(modalEl) {
  modalEl.classList.remove("hidden");
}

function closeModal(modalEl) {
  modalEl.classList.add("hidden");
}

function normalizeCat(v) {
  return (v || "").toUpperCase().trim();
}

function fuzzyMatch(name, q) {
  if (!q) return true;
  return (name || "").toLowerCase().includes(q.toLowerCase());
}

async function fetchMovies() {
  // NOTE: Change table name if yours is different
  const { data, error } = await supabase
    .from("movies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showToast("Movies load failed ❌");
    return;
  }

  allMovies = data || [];
  renderMovies();
}

function renderMovies() {
  const q = searchInput.value.trim();
  const filtered = allMovies.filter((m) => {
    const cat = normalizeCat(m.category);
    return cat === activeTab && fuzzyMatch(m.name, q);
  });

  moviesGrid.innerHTML = "";

  if (!filtered.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  filtered.forEach((m) => {
    const card = document.createElement("div");
    card.className = "movieCard";

    const img = document.createElement("img");
    img.src = m.poster_url || m.poster || "";
    img.alt = m.name || "Movie";

    const overlay = document.createElement("div");
    overlay.className = "movieOverlay";

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "movieTitle";
    title.textContent = m.name || "Untitled";

    const meta = document.createElement("div");
    meta.className = "movieMeta";
    meta.textContent = normalizeCat(m.category);

    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);

    overlay.appendChild(titleWrap);

    card.appendChild(img);
    card.appendChild(overlay);

    card.addEventListener("click", () => openMovie(m));
    moviesGrid.appendChild(card);
  });
}

function openMovie(m) {
  selectedMovie = m;

  modalPoster.src = m.poster_url || m.poster || "";
  modalTitle.textContent = m.name || "";
  modalDesc.textContent = m.description || "No description available.";

  openModal(movieModal);
}

function resetRequestForm() {
  requestForm.reset();
  reqMovieName.value = "";
  reqNotes.value = "";
  submitRequestBtn.disabled = false;
  submitRequestBtn.textContent = "Send Request";
}

function openRequest(movieName = "") {
  resetRequestForm();
  if (movieName) reqMovieName.value = movieName;
  openModal(requestModal);
}

async function sendRequestToSupabase(payload) {
  // NOTE: Change table name if yours is different
  const { error } = await supabase.from("requests").insert([payload]);
  if (error) throw error;
}

async function handleRequestSubmit(e) {
  e.preventDefault();

  const movie_name = reqMovieName.value.trim();
  if (!movie_name) {
    showToast("Movie name required ❌");
    return;
  }

  try {
    submitRequestBtn.disabled = true;
    submitRequestBtn.textContent = "Sending...";

    const payload = {
      movie_name,
      quality: reqQuality.value,
      language: reqLanguage.value,
      notes: reqNotes.value.trim(),
      category: activeTab,
      source: "web",
      created_at: new Date().toISOString(),
    };

    await sendRequestToSupabase(payload);

    showToast("Request sent ✅");
    closeModal(requestModal);
    resetRequestForm();
  } catch (err) {
    console.error(err);
    submitRequestBtn.disabled = false;
    submitRequestBtn.textContent = "Send Request";
    showToast("Request failed ❌");
  }
}

/* Tabs */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    // Adult tab -> show age confirm
    if (tab === "ADULT") {
      pendingAdultTab = true;
      openModal(ageModal);
      return;
    }

    pendingAdultTab = false;
    activeTab = tab;

    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    renderMovies();
  });
});

/* Age confirm */
ageYes.addEventListener("click", () => {
  closeModal(ageModal);

  activeTab = "ADULT";
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
  document.querySelector('.tab[data-tab="ADULT"]').classList.add("active");

  renderMovies();
});

ageNo.addEventListener("click", () => {
  closeModal(ageModal);
  pendingAdultTab = false;

  // go back to Bollywood
  activeTab = "BOLLYWOOD";
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
  document.querySelector('.tab[data-tab="BOLLYWOOD"]').classList.add("active");

  renderMovies();
});

/* Search */
searchInput.addEventListener("input", () => renderMovies());

/* Request modal open/close */
openRequestBtn.addEventListener("click", () => openRequest());
closeRequestModal.addEventListener("click", () => {
  closeModal(requestModal);
  resetRequestForm();
});
cancelRequestBtn.addEventListener("click", () => {
  closeModal(requestModal);
  resetRequestForm();
});

/* Request form submit */
requestForm.addEventListener("submit", handleRequestSubmit);

/* Movie modal close */
closeMovieModal.addEventListener("click", () => closeModal(movieModal));
modalCloseBtn.addEventListener("click", () => closeModal(movieModal));

/* Movie modal request */
modalRequestBtn.addEventListener("click", () => {
  if (!selectedMovie) return;
  closeModal(movieModal);
  openRequest(selectedMovie.name || "");
});

/* Click outside modal close */
movieModal.addEventListener("click", (e) => {
  if (e.target === movieModal) closeModal(movieModal);
});
requestModal.addEventListener("click", (e) => {
  if (e.target === requestModal) {
    closeModal(requestModal);
    resetRequestForm();
  }
});
ageModal.addEventListener("click", (e) => {
  if (e.target === ageModal) closeModal(ageModal);
});

/* Init */
fetchMovies();
