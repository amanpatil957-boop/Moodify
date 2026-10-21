
"use strict";

// ============================================
// 1. CONNECT TO YOUR EXISTING HTML
// ============================================

const fileInput = document.getElementById("fileInput");
const importBtn = document.getElementById("importBtn");
const songGrid = document.getElementById("songGrid");
const searchInput = document.getElementById("search");
const audio = document.getElementById("audio");

const emptyMessage = document.getElementById("emptyMessage");
const songCount = document.getElementById("songCount");
const pageTitle = document.getElementById("pageTitle");
const sectionTitle = document.getElementById("sectionTitle");

const nowTitle = document.getElementById("nowTitle");
const nowArtist = document.getElementById("nowArtist");
const likeCurrent = document.getElementById("likeCurrent");

const previousButton = document.getElementById("previous");
const playPauseButton = document.getElementById("playPause");
const nextButton = document.getElementById("next");

const seek = document.getElementById("seek");
const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");
const volume = document.getElementById("volume");

// ============================================
// 2. DATABASE CONFIGURATION
// ============================================

const DB_NAME = "MoodifyDatabase";
const STORE_NAME = "songs";

let db;
let songs = [];
let currentSongId = null;
let selectedMood = "All";
let currentObjectURL = null;

const moods = [
    "Happy",
    "Sad",
    "Chill",
    "Energetic",
    "Romantic",
    "Focus",
    "Other"
];

// ============================================
// 3. OPEN INDEXEDDB
// ============================================

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// ============================================
// 4. SAVE A SONG PERMANENTLY IN THE BROWSER
// ============================================

function saveSong(song) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const request = transaction
            .objectStore(STORE_NAME)
            .add(song);

        let savedId;

        request.onsuccess = () => {
            savedId = request.result;
        };

        request.onerror = () => {
            reject(request.error);
        };

        transaction.oncomplete = () => {
            resolve(savedId);
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error || new Error("Save aborted"));
        };
    });
}

// ============================================
// 5. UPDATE LIKES AND MOODS
// ============================================

function updateSavedSong(song) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        // Save the audio blob and metadata, not the temporary URL.
        const savedSong = {
            id: song.id,
            title: song.title,
            artist: song.artist,
            mood: song.mood,
            liked: song.liked,
            audioBlob: song.audioBlob
        };

        const request = transaction
            .objectStore(STORE_NAME)
            .put(savedSong);

        request.onerror = () => {
            reject(request.error);
        };

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error || new Error("Update aborted"));
        };
    });
}

// ============================================
// 6. LOAD SAVED SONGS WHEN THE PAGE OPENS
// ============================================

function loadSongs() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readonly"
        );

        const request = transaction
            .objectStore(STORE_NAME)
            .getAll();

        request.onsuccess = () => {
            // Release old temporary audio URLs.
            songs.forEach((song) => {
                if (song.url) {
                    URL.revokeObjectURL(song.url);
                }
            });

            songs = request.result.map((song) => ({
                ...song,
                url: URL.createObjectURL(song.audioBlob)
            }));

            renderSongs();
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// ============================================
// 7. ADD SONGS BUTTON
// ============================================

importBtn.addEventListener("click", () => {
    fileInput.click();
});

// ============================================
// 8. IMPORT AUDIO FILES
// ============================================

fileInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files);

    if (files.length === 0) {
        return;
    }

    try {
        let addedCount = 0;

        for (const file of files) {
            if (
                !file.type.startsWith("audio/") &&
                !/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)$/i.test(file.name)
            ) {
                continue;
            }

            const song = {
                title: file.name.replace(/\.[^/.]+$/, ""),
                artist: "Local file",
                mood: "Chill",
                liked: false,
                audioBlob: file
            };

            const id = await saveSong(song);

            songs.push({
                ...song,
                id,
                url: URL.createObjectURL(file)
            });

            addedCount++;
        }

        renderSongs();

        if (addedCount > 0) {
            alert(`${addedCount} song(s) added to your library!`);
        } else {
            alert("No supported audio files were selected.");
        }
    } catch (error) {
        console.error("Could not save songs:", error);
        alert("Could not save your songs. Check browser storage space.");
    } finally {
        // Allows you to select the same file again later.
        fileInput.value = "";
    }
});

// ============================================
// 9. ESCAPE HTML FOR SAFE DISPLAY
// ============================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// ============================================
// 10. DISPLAY SONGS, SEARCH AND MOOD FILTERS
// ============================================

function renderSongs() {
    const query = searchInput.value.toLowerCase().trim();

    const filteredSongs = songs.filter((song) => {
        const matchesMood =
            selectedMood === "All" ||
            (selectedMood === "Liked"
                ? song.liked
                : song.mood === selectedMood);

        const matchesSearch =
            song.title.toLowerCase().includes(query) ||
            song.artist.toLowerCase().includes(query);

        return matchesMood && matchesSearch;
    });

    songCount.textContent =
        `${filteredSongs.length} song${filteredSongs.length === 1 ? "" : "s"}`;

    sectionTitle.textContent =
        selectedMood === "All"
            ? "Your Music"
            : selectedMood === "Liked"
                ? "Liked Songs"
                : `${selectedMood} Songs`;

    if (filteredSongs.length === 0) {
        songGrid.innerHTML = "";
        emptyMessage.style.display = "block";

        emptyMessage.textContent = songs.length
            ? "No matching songs. Try another search or mood."
            : 'Your library is empty. Click "Add Your Songs" to begin.';

        return;
    }

    emptyMessage.style.display = "none";

    songGrid.innerHTML = filteredSongs.map((song) => `
        <article class="song-card">
            <div class="song-art">♫</div>

            <div class="song-info">
                <h3>${escapeHTML(song.title)}</h3>
                <p>${escapeHTML(song.artist)} · ${escapeHTML(song.mood)}</p>
            </div>

            <div class="song-actions">
                <span class="small-tag">${escapeHTML(song.mood)}</span>

                <button
                    type="button"
                    data-action="like"
                    data-id="${song.id}"
                    aria-label="${song.liked ? "Unlike" : "Like"} ${escapeHTML(song.title)}"
                >${song.liked ? "♥" : "♡"}</button>

                <button
                    type="button"
                    data-action="play"
                    data-id="${song.id}"
                    aria-label="Play ${escapeHTML(song.title)}"
                >▶</button>

                <button
                    type="button"
                    data-action="mood"
                    data-id="${song.id}"
                    aria-label="Change mood for ${escapeHTML(song.title)}"
                >✎</button>
            </div>
        </article>
    `).join("");
}

// ============================================
// 11. HANDLE SONG CARD BUTTONS
// ============================================

songGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const song = songs.find(
        (item) => item.id === Number(button.dataset.id)
    );

    if (!song) {
        return;
    }

    try {
        if (button.dataset.action === "like") {
            song.liked = !song.liked;

            await updateSavedSong(song);
            renderSongs();
            updateCurrentLikeButton();
        }

        if (button.dataset.action === "play") {
            playSong(song);
        }

        if (button.dataset.action === "mood") {
            const chosen = prompt(
                "Choose a mood:\n" + moods.join(", "),
                song.mood
            );

            if (chosen === null) {
                return;
            }

            const selected = moods.find(
                (mood) =>
                    mood.toLowerCase() === chosen.trim().toLowerCase()
            );

            if (!selected) {
                alert("Please enter one of the listed moods.");
                return;
            }

            song.mood = selected;

            await updateSavedSong(song);
            renderSongs();
        }
    } catch (error) {
        console.error("Could not update song:", error);
        alert("Could not update this song. Please try again.");
    }
});

// ============================================
// 12. PLAY A SONG
// ============================================

function playSong(song) {
    if (!song) {
        return;
    }

    currentSongId = song.id;

    audio.src = song.url;
    nowTitle.textContent = song.title;
    nowArtist.textContent = song.artist;

    updateCurrentLikeButton();

    audio.play().catch((error) => {
        console.error("Playback failed:", error);
        alert("Could not play this audio file.");
    });
}

// ============================================
// 13. PLAY / PAUSE
// ============================================

playPauseButton.addEventListener("click", () => {
    if (!currentSongId) {
        if (songs.length > 0) {
            playSong(songs[0]);
        } else {
            alert("Add some music first!");
        }

        return;
    }

    if (audio.paused) {
        audio.play().catch(console.error);
    } else {
        audio.pause();
    }
});

// ============================================
// 14. NEXT AND PREVIOUS SONGS
// ============================================

function playRelativeSong(direction) {
    if (songs.length === 0) {
        return;
    }

    let index = songs.findIndex(
        (song) => song.id === currentSongId
    );

    index = index < 0
        ? 0
        : (index + direction + songs.length) % songs.length;

    playSong(songs[index]);
}

previousButton.addEventListener("click", () => {
    playRelativeSong(-1);
});

nextButton.addEventListener("click", () => {
    playRelativeSong(1);
});

audio.addEventListener("ended", () => {
    playRelativeSong(1);
});

// ============================================
// 15. PLAYER BUTTON STATE
// ============================================

audio.addEventListener("play", () => {
    playPauseButton.textContent = "❚❚";
});

audio.addEventListener("pause", () => {
    playPauseButton.textContent = "▶";
});

// ============================================
// 16. SONG PROGRESS AND TIME
// ============================================

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
        return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");

    return `${minutes}:${remaining}`;
}

audio.addEventListener("loadedmetadata", () => {
    duration.textContent = formatTime(audio.duration);
    seek.value = 0;
});

audio.addEventListener("timeupdate", () => {
    currentTime.textContent = formatTime(audio.currentTime);

    seek.value = audio.duration
        ? (audio.currentTime / audio.duration) * 100
        : 0;
});

seek.addEventListener("input", () => {
    if (audio.duration) {
        audio.currentTime =
            (Number(seek.value) / 100) * audio.duration;
    }
});

// ============================================
// 17. VOLUME
// ============================================

audio.volume = Number(volume.value);

volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
});

// ============================================
// 18. LIKE CURRENT SONG
// ============================================

function updateCurrentLikeButton() {
    const song = songs.find(
        (item) => item.id === currentSongId
    );

    likeCurrent.textContent = song && song.liked ? "♥" : "♡";
}

likeCurrent.addEventListener("click", async () => {
    const song = songs.find(
        (item) => item.id === currentSongId
    );

    if (!song) {
        return;
    }

    try {
        song.liked = !song.liked;

        await updateSavedSong(song);
        renderSongs();
        updateCurrentLikeButton();
    } catch (error) {
        console.error("Could not save like:", error);
        alert("Could not save your like.");
    }
});

// ============================================
// 19. SIDEBAR NAVIGATION
// ============================================

document.querySelectorAll(".nav[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        selectedMood = button.dataset.filter;

        document.querySelectorAll(".nav[data-filter]").forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        pageTitle.textContent =
            selectedMood === "All"
                ? "All Songs"
                : selectedMood === "Liked"
                    ? "Liked Songs"
                    : selectedMood;

        renderSongs();
    });
});

// ============================================
// 20. SEARCH
// ============================================

searchInput.addEventListener("input", renderSongs);

// ============================================
// 21. INITIALIZE MOODIFY
// ============================================

async function initializeMoodify() {
    try {
        db = await openDatabase();
        await loadSongs();

        console.log("Moodify initialized successfully.");
        console.log("Saved songs:", songs.length);
    } catch (error) {
        console.error("Could not initialize Moodify:", error);

        alert(
            "Could not load your music library. " +
            "Check the browser console for details."
        );
    }
}

initializeMoodify();
