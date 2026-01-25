/***********************
  CONFIG (EDIT THIS)
************************/
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE"; // keep public

const POSTERS_BUCKET = "posters";

/***********************
  Supabase REST helper
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

/***********************
  Storage Upload
************************/
async function uploadToBucket(bucketName, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const filePath = safeName;

  await sbFetch(`/storage/v1/object/${bucketName}/${filePath}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file
  });

  return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
}

/***********************
  Helpers
************************/
function normalizeText(s) {
  return (s || "").toLowerCase().replace(/\s+/g, "").trim();
}

function fuzzyMatch(name, query) {
  const a = normalizeText(name);
  const b = normalizeText(query);
  if (!b) return true;
  if (a.includes(b)) return true;
  return false;
}

function toYouTubeEmbed(url) {
  if (!url) return "";
  let id = "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) id = u.pathname.replace("/", "");
    else id = u.searchParams.get("v") || "";
  } catch { return ""; }
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=0` : "";
}

/***********************
  DOM refs
************************/
const grid = document.getElementById("moviesGrid");
const skeletonGrid = document.getElementById("skeletonGrid");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");

// menu
const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const sideOverlay = document.getElementById("sideOverlay");
const closeMenuBtn = document.getElementById("closeMenuBtn");

// modals
const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalPosterBg = document.getElementById("modalPosterBg");
const shareBtn = document.getElementById("shareBtn");
const downloadOpenBtn = document.getElementById("downloadOpenBtn");
const openTrailerBtn = document.getElementById("openTrailerBtn");

// trailer screen
const trailerOverlay = document.getElementById("trailerOverlay");
const closeTrailer = document.getElementById("closeTrailer");
const trailerFrame = document.getElementById("trailerFrame");
const trailerTitle = document.getElementById("trailerTitle");

// download popup
const dlOverlay = document.getElementById("dlOverlay");
const closeDl = document.getElementById("closeDl");
const downloadBtn = document.getElementById("downloadBtn");

// adult confirm
const adultOverlay = document.getElementById("adultOverlay");
const adultCancel = document.getElementById("adultCancel");
const adultContinue = document.getElementById("adultContinue");

// upload
const uploadOverlay = document.getElementById("uploadOverlay");
const openUpload = document.getElementById("openUpload");
const closeUpload = document.getElementById("closeUpload");
const saveUploadBtn = document.getElementById("saveUploadBtn");

// request (direct telegram worker)
const requestOverlay = document.getElementById("requestOverlay");
const openRequest = document.getElementById("openRequest");
const closeRequest = document.getElementById("closeRequest");
const sendRequestBtn = document.getElementById("sendRequestBtn");

// category buttons
const catBtns = document.querySelectorAll(".catBtn");

/***********************
  State
************************/
let allMovies = [];
let activeCat = "BOLLYWOOD";
let selectedMovie = null;

/***********************
  UI
************************/
function showSkeleton() {
  skeletonGrid.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const box = document.createElement("div");
    box.className = "movieCard";
    box.style.opacity = "0.35";
    skeletonGrid.appendChild(box);
  }
}

function hideSkeleton() {
  skeletonGrid.innerHTML = "";
}

function renderSuggestions(query) {
  const q = query.trim();
  if (!q) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  const matches = allMovies
    .filter(m => fuzzyMatch(m.name, q))
    .slice(0, 5);

  if (matches.length === 0) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = "";
  matches.forEach(m => {
    const item = document.createElement("div");
    item.className = "suggItem";
    item.innerHTML = `
      <div class="suggName">${m.name}</div>
      <div class="suggCat">${m.category}</div>
    `;
    item.addEventListener("click", () => {
      searchInput.value = m.name;
      suggestions.classList.add("hidden");
      renderMovies();
      openMovie(m);
    });
    suggestions.appendChild(item);
  });

  suggestions.classList.remove("hidden");
}

function renderMovies() {
  const q = searchInput.value.trim();

  const filtered = allMovies.filter(m => {
    return m.category === activeCat && fuzzyMatch(m.name, q);
  });

  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movieCard";
    card.innerHTML = `
      <img src="${movie.poster_url || ""}" alt="${movie.name}" />
      <div class="movieOverlay">
        <div class="movieTitle">${movie.name}</div>
      </div>
    `;
    card.addEventListener("click", () => openMovie(movie));
    grid.appendChild(card);
  });
}

/***********************
  Movie Modal
************************/
function closeMovieModal() {
  modalOverlay.classList.add("hidden");
  selectedMovie = null;
}

function openMovie(movie) {
  selectedMovie = movie;

  modalTitle.textContent = movie.name || "Movie";
  if (modalPosterBg) modalPosterBg.style.backgroundImage = `url('${movie.poster_url || ""}')`;

  modalOverlay.classList.remove("hidden");
}

/***********************
  Download Popup
************************/
function openDownloadPopup() {
  if (!selectedMovie) return;

  const url = selectedMovie.download_url || selectedMovie.download_720 || selectedMovie.download_480 || "";
  if (!url) {
    alert("Download link not available ❌");
    return;
  }

  downloadBtn.onclick = () => window.open(url, "_blank");
  dlOverlay.classList.remove("hidden");
}

/***********************
  Share
************************/
async function shareMovie(movie) {
  const links = [];
  if (movie.trailer_url) links.push(`Trailer: ${movie.trailer_url}`);
  if (movie.download_url) links.push(`Download: ${movie.download_url}`);

  const text = `🎬 ${movie.name}\n\n${links.join("\n")}`;

  try {
    await navigator.clipboard.writeText(text);
  } catch {}

  // WhatsApp forward
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, "_blank");
}

/***********************
  Load Movies
************************/
async function loadMoviesFromSupabase() {
  showSkeleton();
  try {
    allMovies = await supabaseSelectMovies();
    hideSkeleton();
    renderMovies();
  } catch (e) {
    hideSkeleton();
    console.log("Error loading movies:", e);
  }
}

/***********************
  Menu open/close FIX
************************/
function openMenu() {
  sideMenu.classList.remove("hidden");
  sideOverlay.classList.remove("hidden");
}
function closeMenu() {
  sideMenu.classList.add("hidden");
  sideOverlay.classList.add("hidden");
}

/***********************
  Init
************************/
document.addEventListener("DOMContentLoaded", async () => {
  await loadMoviesFromSupabase();

  // Search
  searchInput.addEventListener("input", () => {
    renderSuggestions(searchInput.value);
    renderMovies();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".searchWrap")) suggestions.classList.add("hidden");
  });

  // MENU FIX
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openMenu();
  });

  closeMenuBtn.addEventListener("click", closeMenu);
  sideOverlay.addEventListener("click", closeMenu);

  // Category clicks
  catBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;

      // adult confirm
      if (cat === "ADULT") {
        adultOverlay.classList.remove("hidden");
        return;
      }

      catBtns.forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      activeCat = cat;
      closeMenu();
      renderMovies();
    });
  });

  // Adult confirm
  adultCancel.addEventListener("click", () => adultOverlay.classList.add("hidden"));
  adultContinue.addEventListener("click", () => {
    adultOverlay.classList.add("hidden");
    catBtns.forEach(x => x.classList.remove("active"));
    document.querySelector(`.catBtn[data-cat="ADULT"]`).classList.add("active");
    activeCat = "ADULT";
    closeMenu();
    renderMovies();
  });

  // Movie modal close
  closeModal.addEventListener("click", closeMovieModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeMovieModal();
  });

  // Trailer screen
  openTrailerBtn.addEventListener("click", () => {
    if (!selectedMovie) return;
    trailerTitle.textContent = selectedMovie.name || "Trailer";
    trailerFrame.src = toYouTubeEmbed(selectedMovie.trailer_url || "");
    trailerOverlay.classList.remove("hidden");
  });

  closeTrailer.addEventListener("click", () => {
    trailerOverlay.classList.add("hidden");
    trailerFrame.src = "";
  });

  trailerOverlay.addEventListener("click", (e) => {
    if (e.target === trailerOverlay) {
      trailerOverlay.classList.add("hidden");
      trailerFrame.src = "";
    }
  });

  // Download popup
  downloadOpenBtn.addEventListener("click", openDownloadPopup);
  closeDl.addEventListener("click", () => dlOverlay.classList.add("hidden"));
  dlOverlay.addEventListener("click", (e) => {
    if (e.target === dlOverlay) dlOverlay.classList.add("hidden");
  });

  // Share
  shareBtn.addEventListener("click", () => {
    if (selectedMovie) shareMovie(selectedMovie);
  });

  // Upload open/close
  openUpload.addEventListener("click", () => {
    closeMenu();
    uploadOverlay.classList.remove("hidden");
  });
  closeUpload.addEventListener("click", () => uploadOverlay.classList.add("hidden"));
  uploadOverlay.addEventListener("click", (e) => {
    if (e.target === uploadOverlay) uploadOverlay.classList.add("hidden");
  });

  // Upload save
  saveUploadBtn.addEventListener("click", async () => {
    const name = document.getElementById("upName").value.trim();
    const category = document.getElementById("upCategory").value;
    const posterFile = document.getElementById("upPoster").files[0];
    const trailer_url = document.getElementById("upTrailer").value.trim();
    const download_url = document.getElementById("upDownload").value.trim();

    if (!name || !posterFile || !trailer_url || !download_url) {
      alert("All required fields fill karo ❌");
      return;
    }

    try {
      saveUploadBtn.disabled = true;
      saveUploadBtn.textContent = "Uploading...";

      const poster_url = await uploadToBucket(POSTERS_BUCKET, posterFile);

      await supabaseInsertMovie({
        name,
        category,
        poster_url,
        trailer_url,
        download_url
      });

      alert("Movie uploaded ✅");
      uploadOverlay.classList.add("hidden");

      document.getElementById("upName").value = "";
      document.getElementById("upPoster").value = "";
      document.getElementById("upTrailer").value = "";
      document.getElementById("upDownload").value = "";

      await loadMoviesFromSupabase();
    } catch (e) {
      console.log(e);
      alert("Upload failed ❌ (RLS/Storage policy)");
    } finally {
      saveUploadBtn.disabled = false;
      saveUploadBtn.textContent = "Save Movie";
    }
  });

  // Request open/close
  openRequest.addEventListener("click", () => {
    closeMenu();
    requestOverlay.classList.remove("hidden");
  });
  closeRequest.addEventListener("click", () => requestOverlay.classList.add("hidden"));
  requestOverlay.addEventListener("click", (e) => {
    if (e.target === requestOverlay) requestOverlay.classList.add("hidden");
  });

  // Request send (direct to worker endpoint)
  sendRequestBtn.addEventListener("click", async () => {
    const movieName = document.getElementById("reqMovieName").value.trim();
    const movieUrl = document.getElementById("reqMovieUrl").value.trim();
    const reqFile = document.getElementById("reqPhotoFile").files[0];

    if (!movieName) {
      alert("Movie name required!");
      return;
    }

    try {
      sendRequestBtn.disabled = true;
      sendRequestBtn.textContent = "Sending...";

      // send to your worker
      const formData = new FormData();
      formData.append("movieName", movieName);
      formData.append("movieUrl", movieUrl);
      if (reqFile) formData.append("photo", reqFile);

      const res = await fetch("https://inzoworld-request.dagurvishal2049.workers.dev/", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!data.ok) throw new Error("Request failed");

      alert("Request sent ✅");
      requestOverlay.classList.add("hidden");
      document.getElementById("reqMovieName").value = "";
      document.getElementById("reqMovieUrl").value = "";
      document.getElementById("reqPhotoFile").value = "";
    } catch (e) {
      console.log(e);
      alert("Failed to send request ❌");
    } finally {
      sendRequestBtn.disabled = false;
      sendRequestBtn.textContent = "Send Request";
    }
  });
});
