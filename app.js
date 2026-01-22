/***********************
  CONFIG (EDIT THIS)
************************/
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

const POSTERS_BUCKET = "posters";
const REQUESTS_BUCKET = "requests";

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
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

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

  let i = 0,
    j = 0,
    match = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      match++;
      j++;
    }
    i++;
  }
  return match >= Math.max(3, Math.floor(b.length * 0.6));
}

function categoryLabel(cat) {
  return cat === "ADULT" ? "18+" : cat;
}

function toYouTubeEmbed(url) {
  if (!url) return "";
  let id = "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) id = u.pathname.replace("/", "");
    else id = u.searchParams.get("v") || "";
  } catch {
    return "";
  }

  // autoplay with sound
  // note: browser policy may block autoplay with sound unless user interacted
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : "";
}

/***********************
  DOM refs (index)
************************/
const grid = document.getElementById("moviesGrid");
const skeletonGrid = document.getElementById("skeletonGrid");
const trendingRow = document.getElementById("trendingRow");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
const activeCatChip = document.getElementById("activeCatChip");

const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const modalTrailer = document.getElementById("modalTrailer");
const modalPosterBg = document.getElementById("modalPosterBg");
const shareBtn = document.getElementById("shareBtn");
const downloadOpenBtn = document.getElementById("downloadOpenBtn");
const relatedRow = document.getElementById("relatedRow");

const dlOverlay = document.getElementById("dlOverlay");
const closeDl = document.getElementById("closeDl");
const q480 = document.getElementById("q480");
const q720 = document.getElementById("q720");
const q1080 = document.getElementById("q1080");
const q4k = document.getElementById("q4k");

const adultOverlay = document.getElementById("adultOverlay");
const closeAdult = document.getElementById("closeAdult");
const adultCancel = document.getElementById("adultCancel");
const adultContinue = document.getElementById("adultContinue");

const requestOverlay = document.getElementById("requestOverlay");
const openRequest = document.getElementById("openRequest");
const closeRequest = document.getElementById("closeRequest");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");
const sendRequestBtn = document.getElementById("sendRequestBtn");

const tabs = document.querySelectorAll(".tab");

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
  for (let i = 0; i < 6; i++) {
    const box = document.createElement("div");
    box.className = "movieCard";
    box.style.height = "230px";
    box.style.opacity = "0.35";
    skeletonGrid.appendChild(box);
  }
}

function hideSkeleton() {
  if (!skeletonGrid) return;
  skeletonGrid.innerHTML = "";
}

function renderTrending() {
  if (!trendingRow) return;
  trendingRow.innerHTML = "";

  const list = allMovies.slice(0, 8);
  list.forEach((m) => {
    const c = document.createElement("div");
    c.className = "trendCard";
    c.innerHTML = `
      <img src="${m.poster_url}" alt="${m.name}">
      <div class="trendTitle">${m.name}</div>
    `;
    c.addEventListener("click", () => openMovie(m));
    trendingRow.appendChild(c);
  });
}

function renderSuggestions(query) {
  if (!suggestions) return;

  const q = query.trim();
  if (!q) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  const matches = allMovies.filter((m) => fuzzyMatch(m.name, q)).slice(0, 5);

  if (matches.length === 0) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = "";
  matches.forEach((m) => {
    const item = document.createElement("div");
    item.className = "suggItem";
    item.innerHTML = `
      <div class="suggName">${m.name}</div>
      <div class="suggCat">${categoryLabel(m.category)}</div>
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
  if (!grid) return;

  const q = searchInput ? searchInput.value.trim() : "";
  const filtered = allMovies.filter((m) => {
    return m.category === activeTab && fuzzyMatch(m.name, q);
  });

  grid.innerHTML = "";

  if (activeCatChip) activeCatChip.textContent = activeTab;

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movieCard";
    card.innerHTML = `
      <span class="badge">${categoryLabel(movie.category)}</span>
      <img src="${movie.poster_url}" alt="${movie.name}" />
      <div class="movieOverlay">
        <div class="movieTitle">${movie.name}</div>
      </div>
    `;
    card.addEventListener("click", () => openMovie(movie));
    grid.appendChild(card);
  });
}

function closeMovieModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.add("hidden");
  if (modalTrailer) modalTrailer.src = "";
  selectedMovie = null;
}

function openMovie(movie) {
  selectedMovie = movie;

  modalTitle.textContent = movie.name;
  modalCategory.textContent = categoryLabel(movie.category);
  modalTrailer.src = toYouTubeEmbed(movie.trailer_url);

  if (modalPosterBg) {
    modalPosterBg.style.backgroundImage = `url('${movie.poster_url}')`;
  }

  // related
  if (relatedRow) {
    relatedRow.innerHTML = "";
    const rel = allMovies
      .filter((x) => x.category === movie.category && x.id !== movie.id)
      .slice(0, 8);

    rel.forEach((r) => {
      const rc = document.createElement("div");
      rc.className = "relCard";
      rc.innerHTML = `
        <img src="${r.poster_url}" alt="${r.name}">
        <div class="relName">${r.name}</div>
      `;
      rc.addEventListener("click", () => openMovie(r));
      relatedRow.appendChild(rc);
    });
  }

  modalOverlay.classList.remove("hidden");
}

/***********************
  Download quality popup
************************/
function setQBtn(btn, url) {
  if (!btn) return;
  if (url && url.trim()) {
    btn.disabled = false;
    btn.classList.add("enabled");
    btn.onclick = () => window.open(url, "_blank");
  } else {
    btn.disabled = true;
    btn.classList.remove("enabled");
    btn.onclick = null;
  }
}

function openDownloadPopup() {
  if (!selectedMovie) return;

  setQBtn(q480, selectedMovie.download_480);
  setQBtn(q720, selectedMovie.download_720);
  setQBtn(q1080, selectedMovie.download_1080);
  setQBtn(q4k, selectedMovie.download_4k);

  dlOverlay.classList.remove("hidden");
}

/***********************
  Share
************************/
async function shareMovie(movie) {
  const url = window.location.href;
  const text = `🎬 ${movie.name}\nWatch on INZOINFO:\n${url}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: movie.name, text, url });
      return;
    } catch {}
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, "_blank");
}

/***********************
  Data load
************************/
async function loadMoviesFromSupabase() {
  showSkeleton();
  try {
    allMovies = await supabaseSelectMovies();
    hideSkeleton();
    renderTrending();
    renderMovies();
  } catch (e) {
    hideSkeleton();
    console.log("Error loading movies:", e);
  }
}

/***********************
  Admin page
************************/
async function initAdminPage() {
  const form = document.getElementById("movieForm");
  if (!form) return;

  const adminList = document.getElementById("adminList");
  const adminStatus = document.getElementById("adminStatus");
  const saveBtn = document.getElementById("saveMovieBtn");

  async function refreshAdminList() {
    const movies = await supabaseSelectMovies();
    adminList.innerHTML = "";
    movies.forEach((m) => {
      const row = document.createElement("div");
      row.className = "adminItem";
      row.innerHTML = `
        <img src="${m.poster_url}" alt="${m.name}">
        <div>
          <div style="font-weight:900">${m.name}</div>
          <div style="opacity:0.7;font-size:12px">${categoryLabel(
            m.category
          )}</div>
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

    const download_480 = document.getElementById("dl480").value.trim() || null;
    const download_720 = document.getElementById("dl720").value.trim() || null;
    const download_1080 =
      document.getElementById("dl1080").value.trim() || null;
    const download_4k = document.getElementById("dl4k").value.trim() || null;

    if (!name || !posterFile || !trailer_url) {
      alert("Movie name, poster and trailer required!");
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Uploading...";
      adminStatus.textContent = "Uploading poster...";

      const poster_url = await uploadToBucket(POSTERS_BUCKET, posterFile);

      adminStatus.textContent = "Saving movie...";
      await supabaseInsertMovie({
        name,
        category,
        poster_url,
        trailer_url,
        download_url:
          download_720 ||
          download_480 ||
          download_1080 ||
          download_4k ||
          trailer_url,
        download_480,
        download_720,
        download_1080,
        download_4k
      });

      adminStatus.textContent = "Movie saved ✅";
      alert("Movie saved ✅");

      form.reset();
      await refreshAdminList();
    } catch (err) {
      console.log(err);
      adminStatus.textContent = "Failed ❌ (check RLS/Storage policies)";
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
  // index
  if (grid) {
    await loadMoviesFromSupabase();

    searchInput.addEventListener("input", () => {
      renderSuggestions(searchInput.value);
      renderMovies();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".searchWrap")) {
        suggestions.classList.add("hidden");
      }
    });

    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        const tab = t.dataset.tab;

        // 18+ confirm
        if (tab === "ADULT") {
          adultOverlay.classList.remove("hidden");
          return;
        }

        tabs.forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        activeTab = tab;
        renderMovies();
      });
    });

    // Adult confirm handlers
    closeAdult.addEventListener("click", () =>
      adultOverlay.classList.add("hidden")
    );
    adultCancel.addEventListener("click", () =>
      adultOverlay.classList.add("hidden")
    );
    adultContinue.addEventListener("click", () => {
      adultOverlay.classList.add("hidden");
      tabs.forEach((x) => x.classList.remove("active"));
      document.querySelector(`.tab[data-tab="ADULT"]`).classList.add("active");
      activeTab = "ADULT";
      renderMovies();
    });

    // Movie modal close (FIXED)
    closeModal.addEventListener("click", closeMovieModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeMovieModal();
    });

    // Download popup
    downloadOpenBtn.addEventListener("click", () => openDownloadPopup());
    closeDl.addEventListener("click", () => dlOverlay.classList.add("hidden"));
    dlOverlay.addEventListener("click", (e) => {
      if (e.target === dlOverlay) dlOverlay.classList.add("hidden");
    });

    // Share
    shareBtn.addEventListener("click", () => {
      if (selectedMovie) shareMovie(selectedMovie);
    });

    // Request popup open/close (FIXED)
    openRequest.addEventListener("click", () => {
      requestOverlay.classList.remove("hidden");
    });

    function closeRequestModal() {
      requestOverlay.classList.add("hidden");
    }

    closeRequest.addEventListener("click", closeRequestModal);
    cancelRequestBtn.addEventListener("click", closeRequestModal);
    requestOverlay.addEventListener("click", (e) => {
      if (e.target === requestOverlay) closeRequestModal();
    });

    // Send Request (NO TELEGRAM HERE)
    sendRequestBtn.addEventListener("click", async () => {
      const nameEl = document.getElementById("reqMovieName");
      const urlEl = document.getElementById("reqMovieUrl");
      const fileEl = document.getElementById("reqPhotoFile");

      const movieName = nameEl.value.trim();
      const movieUrl = urlEl.value.trim();
      const reqFile = fileEl.files[0];

      if (!movieName) {
        alert("Movie name required!");
        return;
      }

      try {
        sendRequestBtn.disabled = true;
        sendRequestBtn.textContent = "Sending...";

        let photoUrl = null;
        if (reqFile) photoUrl = await uploadToBucket(REQUESTS_BUCKET, reqFile);

        await supabaseInsertRequest({
          movie_name: movieName,
          photo_url: photoUrl,
          movie_url: movieUrl || null,
          user_query: (searchInput?.value || "").trim()
        });

        alert("Request sent ✅ (Telegram auto via trigger)");
        closeRequestModal();

        // clear inputs (FIXED)
        nameEl.value = "";
        urlEl.value = "";
        fileEl.value = "";
      } catch (e) {
        console.log(e);
        alert("Failed to send request ❌");
      } finally {
        sendRequestBtn.disabled = false;
        sendRequestBtn.textContent = "Send Request";
      }
    });
  }

  // admin
  await initAdminPage();
});
