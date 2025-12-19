const audio = document.getElementById('audio');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const coverEl = document.getElementById('cover');
const queueListEl = document.getElementById('queueList');
const seekEl = document.getElementById('seek');
const timeEl = document.getElementById('time');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const queueEl = document.getElementById('queue');
const toggleQueueBtn = document.getElementById('toggleQueue');
const volumeSlider = document.getElementById('volumeSlider');
const volumeIcon = document.getElementById('volumeIcon');
const volumePercent = document.getElementById('volumePercent');

let currentId = null;
let seeking = false;
let wasPlaying = false;

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

function renderQueue(queue, currentId) {
  queueListEl.innerHTML = '';
  for (const item of queue) {
    const li = document.createElement('li');
    li.dataset.trackId = item.id;
    
    if (item.is_current) {
      li.classList.add('current');
    }
    
    const title = document.createElement('div');
    title.className = 'queueItemTitle';
    // Use title if available, otherwise filename
    title.textContent = item.title || item.filename || item.id;
    li.appendChild(title);
    
    const details = document.createElement('div');
    details.className = 'queueItemFolder';
    // Show artist and album if available
    const detailsText = [];
    if (item.artist) detailsText.push(item.artist);
    if (item.album) detailsText.push(item.album);
    if (detailsText.length === 0 && item.folder) {
      detailsText.push(item.folder);
    }
    details.textContent = detailsText.join(' • ');
    li.appendChild(details);
    
    li.addEventListener('click', () => jumpToTrack(item.id));
    queueListEl.appendChild(li);
  }
}

async function jumpToTrack(trackId) {
  const wasPlaying = !audio.paused;
  await api(`/api/player/jump/${trackId}`, { method: 'POST' });
  await refreshState(wasPlaying);
}

function setCover(trackId) {
  coverEl.innerHTML = '';
  const img = document.createElement('img');
  img.alt = 'cover';
  img.src = `/api/tracks/${trackId}/cover`;
  img.onerror = () => {
    coverEl.innerHTML = 'No cover';
  };
  coverEl.appendChild(img);
}

function updatePlayPauseButtons(isPlaying) {
  if (isPlaying) {
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
  } else {
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
  }
}

async function refreshState(autoplay = false) {
  const st = await api('/api/state');

  renderQueue(st.queue || [], st.current_id);

  if (st.current_id) {
    if (currentId !== st.current_id) {
      await loadTrack(st.current_id, autoplay);
    }
  }
}

async function nextTrack() {
  const wasPlaying = !audio.paused;
  await api('/api/player/next', { method: 'POST' });
  await refreshState(wasPlaying);
}

async function prevTrack() {
  const wasPlaying = !audio.paused;
  await api('/api/player/prev', { method: 'POST' });
  await refreshState(wasPlaying);
}

async function refreshQueue() {
  await api('/api/rescan', { method: 'POST' });
  currentId = null;
  const wasPlaying = !audio.paused;
  await refreshState(wasPlaying);
}

// Controls

document.getElementById('nextBtn').addEventListener('click', nextTrack);
document.getElementById('prevBtn').addEventListener('click', prevTrack);

playBtn.addEventListener('click', async () => {
  try {
    await audio.play();
    updatePlayPauseButtons(true);
  } catch (err) {
    console.error('Play failed:', err);
  }
});

pauseBtn.addEventListener('click', () => {
  audio.pause();
  updatePlayPauseButtons(false);
});

document.getElementById('rescanBtn').addEventListener('click', refreshQueue);

// Audio event listeners for play/pause state
audio.addEventListener('play', () => updatePlayPauseButtons(true));
audio.addEventListener('pause', () => updatePlayPauseButtons(false));

// Mobile queue toggle
toggleQueueBtn.addEventListener('click', () => {
  queueEl.classList.toggle('visible');
  toggleQueueBtn.classList.toggle('active');
});

// Auto-advance when track ends

audio.addEventListener('ended', async () => {
  await api('/api/player/next', { method: 'POST' });
  await refreshState(true);
});

// Seek bar

audio.addEventListener('timeupdate', () => {
  if (seeking) return;
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  timeEl.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
  if (dur > 0) {
    seekEl.value = String(Math.floor((cur / dur) * 1000));
  } else {
    seekEl.value = '0';
  }
});

seekEl.addEventListener('input', () => {
  seeking = true;
});

seekEl.addEventListener('change', () => {
  const dur = audio.duration || 0;
  if (dur > 0) {
    const v = Number(seekEl.value);
    audio.currentTime = (v / 1000) * dur;
  }
  seeking = false;
});

// Volume control
function updateVolumeIcon(volume) {
  if (volume === 0) {
    volumeIcon.textContent = '🔇';
  } else if (volume < 33) {
    volumeIcon.textContent = '🔈';
  } else if (volume < 66) {
    volumeIcon.textContent = '🔉';
  } else {
    volumeIcon.textContent = '🔊';
  }
}

function setVolume(value) {
  const volume = value / 100;
  audio.volume = volume;
  volumePercent.textContent = `${value}%`;
  updateVolumeIcon(value);
  localStorage.setItem('playerVolume', value);
}

volumeSlider.addEventListener('input', (e) => {
  setVolume(e.target.value);
});

// Restore saved volume
const savedVolume = localStorage.getItem('playerVolume');
if (savedVolume !== null) {
  volumeSlider.value = savedVolume;
  setVolume(savedVolume);
}

// Close queue when clicking outside on mobile
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    if (!queueEl.contains(e.target) && e.target !== toggleQueueBtn) {
      queueEl.classList.remove('visible');
    }
  }
});

// Media Session API support
function updateMediaSession(meta) {
  if (!('mediaSession' in navigator)) return;
  
  const artwork = [];
  if (meta.id) {
    artwork.push({
      src: `/api/tracks/${meta.id}/cover`,
      sizes: '512x512',
      type: 'image/jpeg'
    });
  }
  
  navigator.mediaSession.metadata = new MediaMetadata({
    title: meta.title || meta.filename || 'Unknown',
    artist: meta.artist || meta.folder || '',
    album: meta.album || '',
    artwork: artwork
  });
  
  // Set action handlers
  navigator.mediaSession.setActionHandler('play', async () => {
    try {
      await audio.play();
      updatePlayPauseButtons(true);
    } catch (err) {
      console.error('Media session play failed:', err);
    }
  });
  
  navigator.mediaSession.setActionHandler('pause', () => {
    audio.pause();
    updatePlayPauseButtons(false);
  });
  
  navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
  navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
  
  // Optional: seekforward/seekbackward
  navigator.mediaSession.setActionHandler('seekbackward', () => {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  });
  
  navigator.mediaSession.setActionHandler('seekforward', () => {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  });
}

// Update playback state for Media Session
audio.addEventListener('play', () => {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
});

audio.addEventListener('pause', () => {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
});

// Update Media Session when track changes
async function loadTrack(trackId, autoplay = false) {
  currentId = trackId;
  const meta = await api(`/api/tracks/${trackId}`);

  titleEl.textContent = meta.title || meta.filename;
  subtitleEl.textContent = meta.artist || meta.folder || '';

  setCover(trackId);

  audio.src = `/api/tracks/${trackId}/stream`;
  
  // Update Media Session
  updateMediaSession(meta);
  
  if (autoplay) {
    try {
      await audio.play();
    } catch (err) {
      console.error('Autoplay failed:', err);
    }
  } else {
    updatePlayPauseButtons(false);
  }
}

// Init

refreshState(false).catch(err => {
  titleEl.textContent = 'Failed to load';
  subtitleEl.textContent = String(err);
});
