
const fileInput = document.getElementById("fileInput");
const importBtn = document.getElementById("importBtn");
const songGrid = document.getElementById("songGrid");
const emptyMessage = document.getElementById("emptyMessage");
const search = document.getElementById("search");
const audio = document.getElementById("audio");

let songs = [];
let currentIndex = -1;
let currentFilter = "All";

const moods = [
  "Happy", "Sad", "Chill",
  "Energetic", "Romantic", "Focus", "Other"
];

importBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files);

  for (const file of files) {
    if (!file.type.startsWith("audio/") &&
        !/\.(mp3|wav|m4a|ogg|aac|flac|opus)$/i.test(file.name)) {
      continue;
    }

    songs.push({
      id: crypto.randomUUID(),
      file,
      title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      artist: "Unknown artist",
      mood: "Other",
      liked: false,
      url: URL.createObjectURL(file)
    });
  }

  fileInput.value = "";
  renderSongs();
});

function renderSongs() {
  const query = search.value.toLowerCase().trim();

  const visible = songs
    .map((song, index) => ({ ...song, index }))
    .filter(song => {
      const moodMatch =
        currentFilter === "All" ||
        (currentFilter === "Liked"
          ? song.liked
          : song.mood === currentFilter);

      const searchMatch =
        `${song.title} ${song.artist}`.toLowerCase().includes(query);

      return moodMatch && searchMatch;
    });

  songGrid.innerHTML = "";

  for (const song of visible) {
    const card = document.createElement("article");
    card.className = "song-card";

    const cover = document.createElement("div");
    cover.className = "cover";
    cover.textContent = "♫";

    const title = document.createElement("div");
    title.className = "song-title";
    title.textContent = song.title;

    const artist = document.createElement("div");
    artist.className = "song-artist";
    artist.textContent = song.artist;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const moodSelect = document.createElement("select");
    for (const mood of moods) {
      const option = document.createElement("option");
      option.value = mood;
      option.textContent = mood;
      moodSelect.appendChild(option);
    }
    moodSelect.value = song.mood;
    moodSelect.addEventListener("change", () => {
      songs[song.index].mood = moodSelect.value;
      renderSongs();
    });

    const play = document.createElement("button");
    play.textContent = "▶";
    play.title = "Play song";
    play.addEventListener("click", () => playSong(song.index));

    const like = document.createElement("button");
    like.textContent = song.liked ? "♥" : "♡";
    like.title = "Like song";
    like.addEventListener("click", () => {
      songs[song.index].liked = !songs[song.index].liked;
      renderSongs();
    });

    actions.append(moodSelect, play, like);
    card.append(cover, title, artist, actions);
    songGrid.appendChild(card);
  }

  document.getElementById("songCount").textContent =
    `${visible.length} songs`;

  emptyMessage.style.display =
    visible.length ? "none" : "block";
}

function playSong(index) {
  currentIndex = index;
  const song = songs[index];

  audio.src = song.url;
  audio.play().catch(error => {
    console.error("Playback error:", error);
  });

  document.getElementById("nowTitle").textContent = song.title;
  document.getElementById("nowArtist").textContent = song.artist;
  document.getElementById("playPause").textContent = "Ⅱ";
  document.getElementById("likeCurrent").textContent =
    song.liked ? "♥" : "♡";
}

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".nav").forEach(item =>
      item.classList.toggle("active", item === button)
    );

    document.getElementById("pageTitle").textContent =
      currentFilter === "All" ? "All Songs" :
      currentFilter === "Liked" ? "Liked Songs" :
      `${currentFilter} Songs`;

    renderSongs();
  });
});

search.addEventListener("input", renderSongs);

document.getElementById("playPause").addEventListener("click", () => {
  if (currentIndex === -1) {
    if (songs.length) playSong(0);
  } else if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

audio.addEventListener("play", () => {
  document.getElementById("playPause").textContent = "Ⅱ";
});

audio.addEventListener("pause", () => {
  document.getElementById("playPause").textContent = "▶";
});

function playRelative(step) {
  if (!songs.length) return;
  const next = currentIndex === -1
    ? 0
    : (currentIndex + step + songs.length) % songs.length;
  playSong(next);
}

document.getElementById("previous").addEventListener("click",
  () => playRelative(-1));

document.getElementById("next").addEventListener("click",
  () => playRelative(1));

document.getElementById("likeCurrent").addEventListener("click", () => {
  if (currentIndex === -1) return;
  songs[currentIndex].liked = !songs[currentIndex].liked;
  document.getElementById("likeCurrent").textContent =
    songs[currentIndex].liked ? "♥" : "♡";
  renderSongs();
});

audio.addEventListener("loadedmetadata", () => {
  document.getElementById("duration").textContent =
    formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  document.getElementById("currentTime").textContent =
    formatTime(audio.currentTime);

  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    document.getElementById("seek").value =
      audio.currentTime / audio.duration * 100;
  }
});

document.getElementById("seek").addEventListener("input", event => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Number(event.target.value) / 100 * audio.duration;
  }
});

document.getElementById("volume").addEventListener("input", event => {
  audio.volume = Number(event.target.value);
});

audio.volume = 0.8;

audio.addEventListener("ended", () => playRelative(1));

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

renderSongs();
