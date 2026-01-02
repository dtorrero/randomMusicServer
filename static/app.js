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
const newBatchBtn = document.getElementById('newBatchBtn');
const batchProgressEl = document.getElementById('batchProgress');

let seeking = false;
let queueManager = null;

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

async function renderQueueFromManager() {
  if (!queueManager) return;
  
  const queueWindow = queueManager.getQueueWindow();
  const currentId = queueManager.currentTrackId();
  
  queueListEl.innerHTML = '';
  
  // Show batch progress if element exists
  if (batchProgressEl) {
    const progress = queueManager.getProgress();
    batchProgressEl.textContent = `Track ${progress.position + 1} of ${progress.total}`;
  }
  
  for (const item of queueWindow) {
    const li = document.createElement('li');
    li.dataset.trackId = item.id;
    
    if (item.is_current) {
      li.classList.add('current');
    }
    
    // Fetch track metadata for display
    try {
      const meta = await api(`/api/tracks/${item.id}`);
      
      const title = document.createElement('div');
      title.className = 'queueItemTitle';
      title.textContent = meta.title || meta.filename || item.id;
      li.appendChild(title);
      
      const details = document.createElement('div');
      details.className = 'queueItemFolder';
      const detailsText = [];
      if (meta.artist) detailsText.push(meta.artist);
      if (meta.album) detailsText.push(meta.album);
      if (detailsText.length === 0 && meta.folder) {
        detailsText.push(meta.folder);
      }
      details.textContent = detailsText.join(' • ');
      li.appendChild(details);
      
      // Add creation date if available
      if (meta.folder_mtime) {
        const dateInfo = document.createElement('div');
        dateInfo.className = 'queueItemDate';
        const date = new Date(meta.folder_mtime * 1000);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        dateInfo.textContent = `Added: ${dateStr} ${timeStr}`;
        li.appendChild(dateInfo);
      }
    } catch (error) {
      // Fallback if metadata fetch fails
      const title = document.createElement('div');
      title.className = 'queueItemTitle';
      title.textContent = item.id;
      li.appendChild(title);
      
      const details = document.createElement('div');
      details.className = 'queueItemFolder';
      details.textContent = 'Loading...';
      li.appendChild(details);
    }
    
    li.addEventListener('click', () => jumpToTrack(item.id));
    queueListEl.appendChild(li);
  }
  
  // Show empty state if no tracks
  if (queueWindow.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'no-albums-message';
    emptyMsg.textContent = 'No tracks in queue. Try changing settings or getting a new batch.';
    queueListEl.appendChild(emptyMsg);
  }
}

async function jumpToTrack(trackId) {
  if (!queueManager) return;
  
  const success = queueManager.jumpTo(trackId);
  if (success) {
    await loadTrack(trackId, !audio.paused);
    await renderQueueFromManager();
  }
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

// Queue navigation with client queue manager
async function nextTrack() {
  if (!queueManager) return;
  
  const nextId = queueManager.next();
  if (nextId) {
    await loadTrack(nextId, !audio.paused);
    await renderQueueFromManager();
  } else {
    // No tracks in queue
    titleEl.textContent = 'No tracks';
    subtitleEl.textContent = 'Get a new batch or change settings';
    coverEl.innerHTML = 'No music';
    audio.pause();
    updatePlayPauseButtons(false);
  }
}

async function prevTrack() {
  if (!queueManager) return;
  
  const prevId = queueManager.prev();
  if (prevId) {
    await loadTrack(prevId, !audio.paused);
    await renderQueueFromManager();
  }
}

async function refreshQueue() {
  await api('/api/rescan', { method: 'POST' });
  // Queue manager will handle library changes on next batch request
  if (queueManager) {
    await queueManager.fetchNewBatch();
    const currentId = queueManager.currentTrackId();
    if (currentId) {
      await loadTrack(currentId, !audio.paused);
      await renderQueueFromManager();
    }
  }
}

async function getNewBatch() {
  if (!queueManager) return;
  
  const success = await queueManager.fetchNewBatch();
  if (success) {
    const currentId = queueManager.currentTrackId();
    if (currentId) {
      await loadTrack(currentId, !audio.paused);
    }
    await renderQueueFromManager();
  }
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

// New batch button
if (newBatchBtn) {
  newBatchBtn.addEventListener('click', getNewBatch);
}

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
  await nextTrack();
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
  if (!queueManager) return;
  
  const newSettings = {
    ...queueManager.settings,
    mode: mode
  };
  
  const success = await queueManager.changeSettings(newSettings);
  if (success) {
    updateModeUI(mode, newSettings.time_margin_days, newSettings.date_type);
    const currentId = queueManager.currentTrackId();
    if (currentId) {
      await loadTrack(currentId, !audio.paused);
      await renderQueueFromManager();
    }
  }
}

async function setTimeMargin(days) {
  if (!queueManager) return;
  
  const newSettings = {
    ...queueManager.settings,
    time_margin_days: days
  };
  
  const success = await queueManager.changeSettings(newSettings);
  if (success) {
    updateModeUI(newSettings.mode, days, newSettings.date_type);
    const currentId = queueManager.currentTrackId();
    if (currentId) {
      await loadTrack(currentId, !audio.paused);
      await renderQueueFromManager();
    }
  }
}

async function setDateType(dateType) {
  if (!queueManager) return;
  
  const newSettings = {
    ...queueManager.settings,
    date_type: dateType
  };
  
  const success = await queueManager.changeSettings(newSettings);
  if (success) {
    updateModeUI(newSettings.mode, newSettings.time_margin_days, dateType);
    const currentId = queueManager.currentTrackId();
    if (currentId) {
      await loadTrack(currentId, !audio.paused);
      await renderQueueFromManager();
    }
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

// Update audio ended event to use queue manager
audio.addEventListener('ended', async () => {
  await nextTrack();
});

// Initialize the application
async function initApp() {
  try {
    // Create queue manager
    queueManager = new ClientQueueManager({
      batchSize: 50,
      prefetchThreshold: 10,
      autoPrefetch: true,
      confirmSettingsChange: true
    });
    
    // Initialize queue manager
    const initialTrackId = await queueManager.initialize();
    
    // Load initial track if available
    if (initialTrackId) {
      await loadTrack(initialTrackId, false);
    }
    
    // Render initial queue
    await renderQueueFromManager();
    
    // Update UI with current settings
    const settings = queueManager.settings;
    updateModeUI(settings.mode, settings.time_margin_days, settings.date_type);
    
    console.log('App initialized with personal queue');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    titleEl.textContent = 'Initialization failed';
    subtitleEl.textContent = error.message || 'Check console for details';
  }
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
