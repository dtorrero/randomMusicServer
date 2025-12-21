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
const modeFullRandomBtn = document.getElementById('modeFullRandom');
const modeRecentAlbumsBtn = document.getElementById('modeRecentAlbums');
const timeMarginSelector = document.getElementById('timeMarginSelector');
const timeMarginSelect = document.getElementById('timeMarginSelect');
const dateTypeSelector = document.getElementById('dateTypeSelector');
const dateTypeSelect = document.getElementById('dateTypeSelect');

let currentId = null;
let seeking = false;
let wasPlaying = false;
let currentMode = 'full_random';
let currentTimeMarginDays = 7;
let currentDateType = 'mtime';

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
    
    // Add creation date if available
    if (item.folder_mtime) {
      const dateInfo = document.createElement('div');
      dateInfo.className = 'queueItemDate';
      const date = new Date(item.folder_mtime * 1000);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      dateInfo.textContent = `Added: ${dateStr} ${timeStr}`;
      li.appendChild(dateInfo);
    }
    
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

// Mode switching
function updateModeUI(mode, timeMarginDays, dateType) {
  // Update button states
  if (mode === 'full_random') {
    modeFullRandomBtn.classList.add('active');
    modeRecentAlbumsBtn.classList.remove('active');
    timeMarginSelector.style.display = 'none';
    dateTypeSelector.style.display = 'none';
  } else {
    modeFullRandomBtn.classList.remove('active');
    modeRecentAlbumsBtn.classList.add('active');
    timeMarginSelector.style.display = 'flex';
    dateTypeSelector.style.display = 'flex';
  }
  
  // Update time margin select
  if (timeMarginDays) {
    timeMarginSelect.value = timeMarginDays.toString();
  }
  
  // Update date type select
  if (dateType) {
    dateTypeSelect.value = dateType;
  }
}

async function setMode(mode) {
  try {
    await api('/api/settings/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    currentMode = mode;
    updateModeUI(mode, currentTimeMarginDays);
    // Refresh state to get updated queue
    const wasPlaying = !audio.paused;
    await refreshState(wasPlaying);
  } catch (err) {
    console.error('Failed to set mode:', err);
  }
}

async function setTimeMargin(days) {
  try {
    await api('/api/settings/time_margin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    });
    currentTimeMarginDays = days;
    // Refresh state to get updated queue
    const wasPlaying = !audio.paused;
    await refreshState(wasPlaying);
  } catch (err) {
    console.error('Failed to set time margin:', err);
  }
}

async function setDateType(dateType) {
  try {
    await api('/api/settings/date_type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_type: dateType })
    });
    currentDateType = dateType;
    // Refresh state to get updated queue
    const wasPlaying = !audio.paused;
    await refreshState(wasPlaying);
  } catch (err) {
    console.error('Failed to set date type:', err);
  }
}

// Event listeners for mode buttons
modeFullRandomBtn.addEventListener('click', () => setMode('full_random'));
modeRecentAlbumsBtn.addEventListener('click', () => setMode('recent_albums'));

// Event listener for time margin select
timeMarginSelect.addEventListener('change', (e) => {
  const days = parseInt(e.target.value);
  setTimeMargin(days);
});

// Event listener for date type select
dateTypeSelect.addEventListener('change', (e) => {
  const dateType = e.target.value;
  setDateType(dateType);
});

// Load settings on init
async function loadSettings() {
  try {
    const settings = await api('/api/settings');
    currentMode = settings.mode;
    currentTimeMarginDays = settings.time_margin_days;
    currentDateType = settings.date_type || 'mtime';
    updateModeUI(currentMode, currentTimeMarginDays, currentDateType);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Enhanced refreshState to also update mode UI
const originalRefreshState = refreshState;
refreshState = async function(autoplay = false) {
  const st = await api('/api/state');
  
  // Update mode, time margin, and date type from state
  if (st.mode && st.mode !== currentMode) {
    currentMode = st.mode;
    currentTimeMarginDays = st.time_margin_days || 7;
    currentDateType = st.date_type || 'mtime';
    updateModeUI(currentMode, currentTimeMarginDays, currentDateType);
  }
  
  // Also update date type if changed
  if (st.date_type && st.date_type !== currentDateType) {
    currentDateType = st.date_type;
    dateTypeSelect.value = currentDateType;
  }
  
  renderQueue(st.queue || [], st.current_id);

  // Handle empty queue in recent albums mode
  if (currentMode === 'recent_albums' && (!st.queue || st.queue.length === 0)) {
    const timeMarginText = getTimeMarginText(currentTimeMarginDays);
    const message = `No albums added ${timeMarginText}`;
    // Display message in queue area
    queueListEl.innerHTML = `<div class="no-albums-message">${message}</div>`;
    
    // Also update player UI to show no track is playing
    titleEl.textContent = 'No recent albums';
    subtitleEl.textContent = `Try a different time margin or switch to Full Random mode`;
    coverEl.innerHTML = 'No music';
    
    // Stop audio if playing
    if (!audio.paused) {
      audio.pause();
      updatePlayPauseButtons(false);
    }
    currentId = null;
  } else if (st.current_id) {
    if (currentId !== st.current_id) {
      await loadTrack(st.current_id, autoplay);
    }
  }
};

// Helper function to get time margin text
function getTimeMarginText(days) {
  switch(days) {
    case 7: return 'in the last week';
    case 14: return 'in the last 2 weeks';
    case 30: return 'in the last month';
    case 90: return 'in the last 3 months';
    default: return `in the last ${days} days`;
  }
}

// Init
loadSettings().then(() => {
  refreshState(false).catch(err => {
    titleEl.textContent = 'Failed to load';
    subtitleEl.textContent = String(err);
  });
});
