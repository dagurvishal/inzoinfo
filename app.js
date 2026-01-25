/***********************
  CONFIG
************************/
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

// Request Worker URL (Telegram)
const REQUEST_API_URL = "https://inzoworld-request.dagurvishal2049.workers.dev/";

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

  let i = 0, j = 0, match = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { match++; j++; }
    i++;
  }
  return match >= Math.max(3, Math.floor(b.length * 0.6));
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

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  }
}

/***********************
  DOM refs
************************/
const grid = document.getElementById("moviesGrid");
const skeletonGrid = document.getElementById("skeletonGrid");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");

// Menu
const menuBtn = document.getElementById("menuBtn");
const sideMenuOverlay = document.getElementById("sideMenuOverlay");
const closeMenuBtn = document.getElementById("closeMenuBtn");

const menuItems = document.querySelectorAll(".menuItem");
const tabBtns = document.querySelectorAll(".tabBtn");

// Movie modal
const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalPosterBg = document.getElementById("modalPosterBg");
const trailerTapArea = document.getElementById("trailerTapArea");

const shareBtn = document.getElementById("shareBtn");
const downloadBtn = document.getElementById("downloadBtn");

// Trailer overlay
const trailerOverlay = document.getElementById("trailerOverlay");
const closeTrailer = document.getElementById("closeTrailer");
const trailerFrame = document.getElementById("trailerFrame");
const trailerTitle = document.getElementById("trailerTitle");

// Adult overlay
const adultOverlay = document.getElementById("adultOverlay");
const adultCancel = document.getElementById("adultCancel");
const adultContinue = document.getElementById("adultContinue");

// Upload overlay
const uploadOverlay = document.getElementById("uploadOverlay");
const closeUpload = document.getElementById("closeUpload");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");

// Request overlay
const requestOverlay = document.getElementById("requestOverlay");
const closeRequest = document.getElementById("closeRequest");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");
const sendRequestBtn = document.getElementById("sendRequestBtn");
const reqStatus = document.getElementById("reqStatus");

/***********************
  State
************************/
let allMovies = [];
let activeTab = "BOLLYWOOD";
let selectedMovie = null;

/***********************
  UI helpers
************************/
function showSkeleton() {
  if (!skeletonGrid) return;
  skeletonGrid.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const box = document.createElement("div");
    box.className = "movieCard";
    box.style.height = "220px";
    box.style.opacity = "0.35";
    skeletonGrid.appendChild(box);
  }
}

function hideSkeleton() {
  if (!skeletonGrid) return;
  skeletonGrid.innerHTML = "";
}

function renderSuggestions(query) {
  if (!suggestions) return;

  const q = query.trim();
  if (!q) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  const matches = allMovies
    .filter(m => fuzzyMatch(m.name, q))
    .slice(0, 6);

  if (matches.length === 0) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = "";
  matches.forEach(m => {
    const item = document.createElement("div");
    item.className = "suggItem";
    item.innerHTML = `<div class="suggName">${m.name}</div>`;
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
  if (!grid) return;

  const q = searchInput ? searchInput.value.trim() : "";
  const filtered = allMovies.filter(m => {
    return m.category === activeTab && fuzzyMatch(m.name, q);
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

function closeMovieModal() {
  modalOverlay.classList.add("hidden");
  selectedMovie = null;
}

function openMovie(movie) {
  selectedMovie = movie;

  modalTitle.textContent = movie.name || "Movie";
  if (modalPosterBg) modalPosterBg.style.backgroundImage = `url('${movie.poster_url || ""}')`;

  // download button state
  const dl = (movie.download_url || movie.download_link || movie.download || movie.download_720 || "").trim?.() || movie.download_720 || movie.download_480 || "";
  if (dl && dl.length > 5) {
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => window.open(dl, "_blank");
  } else {
    downloadBtn.disabled = true;
    downloadBtn.onclick = null;
  }

  modalOverlay.classList.remove("hidden");
}

/***********************
  Data load
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
  Request (Telegram Worker)
************************/
async function sendRequestToTelegram({ movieName, movieUrl, photoBase64 }) {
  const payload = {
    movieName,
    movieUrl,
    photoBase64: photoBase64 || null,
    source: "inzoworld"
  };

  const res = await fetch(REQUEST_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return await res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    if (!e.target.closest(".searchWrap")) {
      suggestions.classList.add("hidden");
    }
  });

  // Menu open/close
  menuBtn.addEventListener("click", () => {
    sideMenuOverlay.classList.remove("hidden");
  });
  closeMenuBtn.addEventListener("click", () => {
    sideMenuOverlay.classList.add("hidden");
  });
  sideMenuOverlay.addEventListener("click", (e) => {
    if (e.target === sideMenuOverlay) sideMenuOverlay.classList.add("hidden");
  });

  // Home / Upload / Request
  menuItems.forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.menu;
      menuItems.forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      if (page === "upload") uploadOverlay.classList.remove("hidden");
      if (page === "request") requestOverlay.classList.remove("hidden");

      if (page === "home") {
        uploadOverlay.classList.add("hidden");
        requestOverlay.classList.add("hidden");
      }

      sideMenuOverlay.classList.add("hidden");
    });
  });

  // Category tabs inside menu
  tabBtns.forEach(t => {
    t.addEventListener("click", () => {
      const tab = t.dataset.tab;

      if (tab === "ADULT") {
        adultOverlay.classList.remove("hidden");
        return;
      }

      tabBtns.forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      activeTab = tab;
      renderMovies();
      sideMenuOverlay.classList.add("hidden");
    });
  });

  // Adult confirm
  adultCancel.addEventListener("click", () => adultOverlay.classList.add("hidden"));
  adultContinue.addEventListener("click", () => {
    adultOverlay.classList.add("hidden");
    tabBtns.forEach(x => x.classList.remove("active"));
    document.querySelector(`.tabBtn[data-tab="ADULT"]`).classList.add("active");
    activeTab = "ADULT";
    renderMovies();
    sideMenuOverlay.classList.add("hidden");
  });

  // Movie modal close
  closeModal.addEventListener("click", closeMovieModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeMovieModal();
  });

  // Trailer tap => open trailer overlay
  trailerTapArea.addEventListener("click", () => {
    if (!selectedMovie) return;
    const embed = toYouTubeEmbed(selectedMovie.trailer_url || "");
    if (!embed) return alert("Trailer link not available ❌");

    trailerTitle.textContent = selectedMovie.name || "Trailer";
    trailerFrame.src = embed;
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

  // Share
  shareBtn.addEventListener("click", async () => {
    if (!selectedMovie) return;

    const trailer = selectedMovie.trailer_url || "";
    const dl = selectedMovie.download_url || selectedMovie.download_720 || "";
    const text =
`🎬 ${selectedMovie.name}

▶ Trailer: ${trailer || "N/A"}
⬇ Download: ${dl || "N/A"}`;

    await copyToClipboard(text);

    // WhatsApp forward
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  });

  // Upload close
  closeUpload.addEventListener("click", () => uploadOverlay.classList.add("hidden"));
  cancelUploadBtn.addEventListener("click", () => uploadOverlay.classList.add("hidden"));

  // Upload submit
  uploadBtn.addEventListener("click", async () => {
    const name = document.getElementById("upName").value.trim();
    const category = document.getElementById("upCategory").value;
    const posterFile = document.getElementById("upPoster").files[0];
    const trailer_url = document.getElementById("upTrailer").value.trim();
    const download_720 = document.getElementById("upDownload").value.trim();

    if (!name || !category || !posterFile || !trailer_url || !download_720) {
      alert("All fields required ❌");
      return;
    }

    try {
      uploadBtn.disabled = true;
      uploadStatus.textContent = "Uploading banner...";

      const poster_url = await uploadToBucket(POSTERS_BUCKET, posterFile);

      uploadStatus.textContent = "Saving movie...";
      await supabaseInsertMovie({
        name,
        category,
        poster_url,
        trailer_url,
        download_720
      });

      uploadStatus.textContent = "Uploaded ✅";
      alert("Movie uploaded ✅");

      document.getElementById("upName").value = "";
      document.getElementById("upTrailer").value = "";
      document.getElementById("upDownload").value = "";
      document.getElementById("upPoster").value = "";

      await loadMoviesFromSupabase();
      uploadOverlay.classList.add("hidden");
    } catch (e) {
      console.log(e);
      uploadStatus.textContent = "Upload failed ❌ (RLS/Storage)";
      alert("Upload failed ❌");
    } finally {
      uploadBtn.disabled = false;
    }
  });

  // Request close
  closeRequest.addEventListener("click", () => requestOverlay.classList.add("hidden"));
  cancelRequestBtn.addEventListener("click", () => requestOverlay.classList.add("hidden"));

  // Request submit => Telegram worker
  sendRequestBtn.addEventListener("click", async () => {
    const movieName = document.getElementById("reqMovieName").value.trim();
    const movieUrl = document.getElementById("reqMovieUrl").value.trim();
    const reqFile = document.getElementById("reqPhotoFile").files[0];

    if (!movieName) {
      alert("Movie name required ❌");
      return;
    }

    try {
      sendRequestBtn.disabled = true;
      reqStatus.textContent = "Sending request...";

      let photoBase64 = null;
      if (reqFile) {
        photoBase64 = await fileToBase64(reqFile);
      }

      const result = await sendRequestToTelegram({
        movieName,
        movieUrl,
        photoBase64
      });

      console.log("Request result:", result);

      reqStatus.textContent = "Request sent ✅";
      alert("Request sent ✅");

      document.getElementById("reqMovieName").value = "";
      document.getElementById("reqMovieUrl").value = "";
      document.getElementById("reqPhotoFile").value = "";

      requestOverlay.classList.add("hidden");
    } catch (e) {
      console.log(e);
      reqStatus.textContent = "Failed to send request ❌";
      alert("Failed to send request ❌");
    } finally {
      sendRequestBtn.disabled = false;
    }
  });
});
