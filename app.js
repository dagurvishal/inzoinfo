/***********************
  SUPABASE CONFIG
************************/
const SUPABASE_URL = "https://ehnkxlccztcjqznuwtto.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobmt4bGNjenRjanF6bnV3dHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNzEyMjcsImV4cCI6MjA4NDY0NzIyN30.EnG1ThOcPNj3mdzrTY-fwDwy5nsEW1GdOqLYgnIbthc";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/***********************
  UI ELEMENTS
************************/
const moviesList = document.getElementById("moviesList");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");

const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const modalPosterBg = document.getElementById("modalPosterBg");
const modalPoster = document.getElementById("modalPoster");
const posterFadeTitle = document.getElementById("posterFadeTitle");

const trailerBtn = document.getElementById("trailerBtn");
const downloadBtn = document.getElementById("downloadBtn");
const shareBtn = document.getElementById("shareBtn");

const trailerOverlay = document.getElementById("trailerOverlay");
const closeTrailer = document.getElementById("closeTrailer");
const modalTrailer = document.getElementById("modalTrailer");

const dlOverlay = document.getElementById("dlOverlay");
const closeDl = document.getElementById("closeDl");
const dlBackBtn = document.getElementById("dlBackBtn");
const dlShareBtn = document.getElementById("dlShareBtn");

const q480 = document.getElementById("q480");
const q720 = document.getElementById("q720");
const q1080 = document.getElementById("q1080");
const q2160 = document.getElementById("q2160");
const qExtra1 = document.getElementById("qExtra1");
const watchOnline = document.getElementById("watchOnline");

const adultOverlay = document.getElementById("adultOverlay");
const adultCancel = document.getElementById("adultCancel");
const adultContinue = document.getElementById("adultContinue");

const requestOverlay = document.getElementById("requestOverlay");
const openRequest = document.getElementById("openRequest");
const closeRequest = document.getElementById("closeRequest");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");
const sendRequestBtn = document.getElementById("sendRequestBtn");
const reqMovieName = document.getElementById("reqMovieName");
const reqNote = document.getElementById("reqNote");
const reqPhotoFile = document.getElementById("reqPhotoFile");
const reqStatus = document.getElementById("reqStatus");

const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");
const sideOverlay = document.getElementById("sideOverlay");
const closeMenuBtn = document.getElementById("closeMenuBtn");

/***********************
  STATE
************************/
let ACTIVE_TAB = "BOLLYWOOD";
let ALL_MOVIES = [];
let FILTERED_MOVIES = [];

let selectedMovie = null; // currently opened movie object

/***********************
  HELPERS
************************/
function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function toast(msg) {
  alert(msg); // simple + safe for mobile
}

function escapeHtml(str="") {
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

function setButtonDisabled(btn, disabled=true) {
  if (!btn) return;
  btn.classList.toggle("disabled", disabled);
  btn.disabled = disabled;
}

/***********************
  MENU
************************/
menuBtn?.addEventListener("click", () => {
  show(sideOverlay);
  show(sideMenu);
});
closeMenuBtn?.addEventListener("click", () => {
  hide(sideOverlay);
  hide(sideMenu);
});
sideOverlay?.addEventListener("click", () => {
  hide(sideOverlay);
  hide(sideMenu);
});

/***********************
  TABS
************************/
function setActiveTab(tabName) {
  ACTIVE_TAB = tabName;

  document.querySelectorAll(".tabBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  if (tabName === "ADULT") {
    show(adultOverlay);
    return;
  }

  applyFilters();
}

document.querySelectorAll(".tabBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const t = btn.dataset.tab;
    if (t) setActiveTab(t);
  });
});

/***********************
  ADULT CONFIRM
************************/
adultCancel?.addEventListener("click", () => {
  hide(adultOverlay);
  setActiveTab("BOLLYWOOD");
});

adultContinue?.addEventListener("click", () => {
  hide(adultOverlay);
  applyFilters();
});

/***********************
  FETCH MOVIES
************************/
async function loadMovies() {
  try {
    // Table name assumed: "movies"
    // Columns assumed: title, category, poster_url, trailer_url, link_480, link_720, link_1080, link_2160, watch_url
    const { data, error } = await sb
      .from("movies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    ALL_MOVIES = data || [];
    applyFilters();
  } catch (e) {
    console.error(e);
    toast("Movies load failed ❌");
  }
}

/***********************
  FILTER + SEARCH
************************/
function applyFilters() {
  const q = (searchInput?.value || "").trim().toLowerCase();

  FILTERED_MOVIES = ALL_MOVIES.filter(m => {
    const cat = (m.category || "").toUpperCase();
    const title = (m.title || m.movie_name || "").toLowerCase();

    const matchTab =
      (ACTIVE_TAB === "BOLLYWOOD" && cat.includes("BOLLY")) ||
      (ACTIVE_TAB === "HOLLYWOOD" && cat.includes("HOLLY")) ||
      (ACTIVE_TAB === "ADULT" && (cat.includes("ADULT") || cat.includes("18")));

    const matchSearch = !q || title.includes(q);

    return matchTab && matchSearch;
  });

  renderMovies(FILTERED_MOVIES);
  renderSuggestions(q);
}

function renderSuggestions(q) {
  if (!suggestions) return;

  if (!q || q.length < 2) {
    hide(suggestions);
    suggestions.innerHTML = "";
    return;
  }

  const top = FILTERED_MOVIES.slice(0, 6);
  if (!top.length) {
    hide(suggestions);
    suggestions.innerHTML = "";
    return;
  }

  suggestions.innerHTML = top
    .map(m => `<div class="sugItem" data-id="${m.id}">${escapeHtml(m.title || "Untitled")}</div>`)
    .join("");

  show(suggestions);

  suggestions.querySelectorAll(".sugItem").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const movie = FILTERED_MOVIES.find(x => String(x.id) === String(id));
      if (movie) openMovieModal(movie);
      hide(suggestions);
    });
  });
}

searchInput?.addEventListener("input", applyFilters);
document.addEventListener("click", (e) => {
  if (!suggestions) return;
  if (!suggestions.contains(e.target) && e.target !== searchInput) {
    hide(suggestions);
  }
});

/***********************
  RENDER MOVIES LIST
************************/
function renderMovies(list) {
  if (!moviesList) return;

  moviesList.innerHTML = "";

  if (!list || list.length === 0) {
    show(emptyState);
    return;
  }
  hide(emptyState);

  list.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movieCard glass";

    const poster = document.createElement("img");
    poster.className = "poster";
    poster.src = movie.poster_url || "https://via.placeholder.com/300x450?text=Poster";
    poster.alt = movie.title || "Poster";

    const info = document.createElement("div");
    info.className = "movieInfo";

    const title = document.createElement("div");
    title.className = "movieTitle";
    title.textContent = movie.title || "Untitled Movie";

    const meta = document.createElement("div");
    meta.className = "movieMeta";
    meta.textContent = (movie.category || ACTIVE_TAB);

    info.appendChild(title);
    info.appendChild(meta);

    card.appendChild(poster);
    card.appendChild(info);

    card.addEventListener("click", () => openMovieModal(movie));
    moviesList.appendChild(card);
  });
}

/***********************
  MOVIE MODAL
************************/
function openMovieModal(movie) {
  selectedMovie = movie;

  modalTitle.textContent = movie.title || "Movie";
  modalCategory.textContent = movie.category || "";

  const posterUrl = movie.poster_url || "";
  modalPoster.src = posterUrl || "https://via.placeholder.com/600x400?text=Poster";
  posterFadeTitle.textContent = movie.title || "";

  modalPosterBg.style.backgroundImage = posterUrl ? `url('${posterUrl}')` : "none";

  show(modalOverlay);
}

function closeMovieModal() {
  hide(modalOverlay);
  selectedMovie = null;
}

closeModal?.addEventListener("click", closeMovieModal);
modalOverlay?.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeMovieModal();
});

/***********************
  TRAILER (ONLY ON TAP)
************************/
trailerBtn?.addEventListener("click", () => {
  if (!selectedMovie) return;

  const url = selectedMovie.trailer_url || "";
  if (!url) {
    toast("Trailer not available ❌");
    return;
  }

  // Autoplay only after user click
  modalTrailer.src = url.includes("?")
    ? `${url}&autoplay=1`
    : `${url}?autoplay=1`;

  show(trailerOverlay);
});

function closeTrailerScreen() {
  hide(trailerOverlay);
  modalTrailer.src = ""; // stop video
}

closeTrailer?.addEventListener("click", closeTrailerScreen);
trailerOverlay?.addEventListener("click", (e) => {
  if (e.target === trailerOverlay) closeTrailerScreen();
});

/***********************
  DOWNLOAD SCREEN
************************/
downloadBtn?.addEventListener("click", () => {
  if (!selectedMovie) return;

  // Map links from DB
  const links = {
    "480p": selectedMovie.link_480 || "",
    "720p": selectedMovie.link_720 || "",
    "1080p": selectedMovie.link_1080 || "",
    "2160p": selectedMovie.link_2160 || "",
    "Fast Link": selectedMovie.fast_link || selectedMovie.link_fast || "",
    "Watch Online": selectedMovie.watch_url || ""
  };

  // Enable/disable buttons
  setButtonDisabled(q480, !links["480p"]);
  setButtonDisabled(q720, !links["720p"]);
  setButtonDisabled(q1080, !links["1080p"]);
  setButtonDisabled(q2160, !links["2160p"]);
  setButtonDisabled(qExtra1, !links["Fast Link"]);
  setButtonDisabled(watchOnline, !links["Watch Online"]);

  // Attach open actions
  q480.onclick = () => window.open(links["480p"], "_blank");
  q720.onclick = () => window.open(links["720p"], "_blank");
  q1080.onclick = () => window.open(links["1080p"], "_blank");
  q2160.onclick = () => window.open(links["2160p"], "_blank");
  qExtra1.onclick = () => window.open(links["Fast Link"], "_blank");
  watchOnline.onclick = () => window.open(links["Watch Online"], "_blank");

  // Share from download modal
  dlShareBtn.onclick = async () => {
    await shareAllLinks(selectedMovie);
  };

  show(dlOverlay);
});

function closeDownloadModal() {
  hide(dlOverlay);
}

closeDl?.addEventListener("click", closeDownloadModal);
dlBackBtn?.addEventListener("click", closeDownloadModal);
dlOverlay?.addEventListener("click", (e) => {
  if (e.target === dlOverlay) closeDownloadModal();
});

/***********************
  SHARE LINKS (COPY + WHATSAPP)
************************/
async function shareAllLinks(movie) {
  if (!movie) return;

  const lines = [];
  lines.push(`🎬 ${movie.title || "Movie"}`);
  lines.push(`Category: ${movie.category || ""}`);
  lines.push("");

  const add = (label, url) => {
    if (url) lines.push(`${label}: ${url}`);
  };

  add("480p", movie.link_480);
  add("720p", movie.link_720);
  add("1080p", movie.link_1080);
  add("2160p", movie.link_2160);
  add("Fast Link", movie.fast_link || movie.link_fast);
  add("Watch Online", movie.watch_url);

  const text = lines.join("\n");

  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.warn("Clipboard failed", e);
  }

  // WhatsApp share open
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, "_blank");

  toast("Links copied + WhatsApp opened ✅");
}

shareBtn?.addEventListener("click", async () => {
  if (!selectedMovie) return;
  await shareAllLinks(selectedMovie);
});

/***********************
  REQUEST MODAL
************************/
openRequest?.addEventListener("click", () => {
  show(requestOverlay);
  reqStatus.textContent = "";
});

function closeRequestPopup() {
  hide(requestOverlay);
  reqMovieName.value = "";
  reqNote.value = "";
  if (reqPhotoFile) reqPhotoFile.value = "";
  reqStatus.textContent = "";
}

closeRequest?.addEventListener("click", closeRequestPopup);
cancelRequestBtn?.addEventListener("click", closeRequestPopup);
requestOverlay?.addEventListener("click", (e) => {
  if (e.target === requestOverlay) closeRequestPopup();
});

/***********************
  PHOTO UPLOAD + REQUEST INSERT
************************/
async function uploadRequestPhoto(file) {
  if (!file) return null;

  const ext = file.name.split(".").pop();
  const fileName = `request_${Date.now()}.${ext}`;

  const { data, error } = await sb.storage
    .from("request-photos")
    .upload(fileName, file, { upsert: true });

  if (error) throw error;

  const { data: pub } = sb.storage
    .from("request-photos")
    .getPublicUrl(data.path);

  return pub.publicUrl;
}

sendRequestBtn?.addEventListener("click", async () => {
  try {
    const name = reqMovieName.value.trim();
    const note = reqNote.value.trim();
    const file = reqPhotoFile?.files?.[0] || null;

    if (!name) {
      toast("Movie name required!");
      return;
    }

    sendRequestBtn.disabled = true;
    sendRequestBtn.textContent = "Sending...";
    reqStatus.textContent = "Uploading / Saving...";

    let photo_url = null;
    if (file) {
      photo_url = await uploadRequestPhoto(file);
    }

    const { error } = await sb.from("requests").insert([
      {
        movie_name: name,
        note: note || null,
        photo_url: photo_url || null,
        source: "inzoworld_web"
      }
    ]);

    if (error) throw error;

    reqStatus.textContent = "Request Sent ✅";
    toast("Request Sent ✅");
    closeRequestPopup();
  } catch (err) {
    console.error(err);
    reqStatus.textContent = "Request Failed ❌";
    toast("Failed to send request ❌ (RLS / Network)");
  } finally {
    sendRequestBtn.disabled = false;
    sendRequestBtn.textContent = "Send Request";
  }
});

/***********************
  INIT
************************/
loadMovies();
