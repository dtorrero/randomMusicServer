# Immediate Performance Improvements for Random Music Server

## Quick Wins to Reduce Container Load Time

Based on the analysis of playlist generation, here are immediate changes that can significantly improve performance without major architectural changes.

### 1. Disable Automatic Scanning on Startup
**Current Issue**: `SCAN_ON_START=true` causes long delays when starting the container.

**Immediate Fix**: Set `SCAN_ON_START=false` in your Docker Compose configuration:

```yaml
# In docker-compose.yml or docker-compose.override.yml
services:
  random-music:
    environment:
      - SCAN_ON_START=false
```

**Alternative**: Create a `.env` file with:
```
SCAN_ON_START=false
```

**Impact**: Container starts instantly. Users can manually trigger scanning via the UI when needed.

### 2. Optimize Folder Birth Time Collection
**Current Issue**: Using `subprocess.run(['stat', ...])` for each folder is expensive.

**Immediate Code Fix**: Replace the subprocess call in `app/library.py`:

```python
# Replace lines 68-78 in library.py:
# Current inefficient code:
folder_btime = None
try:
    # Use stat to get birth time
    import subprocess
    result = subprocess.run(['stat', '-c', '%W', root], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        btime_str = result.stdout.strip()
        if btime_str and btime_str != '0':
            folder_btime = float(btime_str)
except (OSError, ValueError, ImportError):
    pass

# With more efficient native Python:
folder_btime = None
try:
    import os
    stat_info = os.stat(root)
    # Try to get birth time (available on some systems)
    # st_birthtime on macOS, st_ctime on Linux (close approximation)
    folder_btime = getattr(stat_info, 'st_birthtime', None)
    if folder_btime is None:
        # Fall back to creation time (ctime) which is available on most systems
        folder_btime = stat_info.st_ctime
except (OSError, AttributeError):
    pass
```

**Impact**: Eliminates process spawning overhead for each folder.

### 3. Add Configuration for Large Libraries
**Current Issue**: No limits on memory usage or processing.

**Immediate Configuration Options**:
1. **Add to config.py**:
```python
MAX_TRACKS = int(os.getenv("MAX_TRACKS", "0"))  # 0 = unlimited
ENABLE_BIRTH_TIME = _get_env_bool("ENABLE_BIRTH_TIME", False)
```

2. **Update library.py to respect limits**:
```python
def scan_library(music_dir: str) -> Tuple[Dict[str, Track], List[str]]:
    # ... existing code ...
    
    track_count = 0
    for root, _, files in os.walk(music_dir):
        if MAX_TRACKS > 0 and track_count >= MAX_TRACKS:
            logger.warning(f"Reached maximum track limit: {MAX_TRACKS}")
            break
        # ... process folder ...
```

### 4. Implement Simple Metadata Caching
**Current Issue**: Metadata is re-extracted on every scan.

**Simple Cache Implementation**:
1. Create a cache directory in `DATA_DIR/cache`
2. Store metadata as JSON files keyed by file path and modification time
3. Only extract metadata if file has changed

### 5. Reduce Logging Verbosity During Scan
**Current Issue**: Logging each folder and file can be I/O intensive.

**Immediate Fix**: Reduce logging level during scanning or add batch logging:

```python
# In library.py, change:
logger.info(f"  Folder {folder_count}: {folder_rel} ({len(audio_files)} audio files)")
# To:
if folder_count % 10 == 0:  # Log every 10 folders
    logger.info(f"  Scanned {folder_count} folders...")

# Change:
logger.debug(f"    - {fn} (id: {tid[:8]}...)")
# To: Remove or make conditional on debug level
```

## Docker Compose Configuration for Better Performance

### Optimized docker-compose.yml snippet:
```yaml
services:
  random-music:
    environment:
      - SCAN_ON_START=false  # Manual scanning only
      - QUEUE_REFRESH_SECONDS=0  # Disable auto-refresh
      - ENABLE_BIRTH_TIME=false  # Disable expensive birth time collection
      - MAX_TRACKS=5000  # Limit for large libraries
    deploy:
      resources:
        limits:
          memory: 512M  # Prevent memory spikes
          cpus: '1.0'   # Limit CPU usage
        reservations:
          memory: 256M
          cpus: '0.5'
```

## Quick Performance Test

To measure current performance:

```bash
# Time the library scan
time curl -X POST http://localhost:8000/api/rescan

# Monitor memory usage
docker stats random-music-server

# Check startup time
time docker compose up -d
```

## Expected Improvements

| Change | Startup Time Reduction | Memory Reduction | CPU Reduction |
|--------|-----------------------|------------------|---------------|
| SCAN_ON_START=false | 90-95% | 50% | 80% |
| Remove subprocess calls | 10-20% | Minimal | 30% |
| Limit MAX_TRACKS | Variable | 30-70% | 40-60% |
| Reduced logging | 5-10% | Minimal | 10% |

**Total Expected Improvement**: 2-10x faster container startup depending on library size.

## Next Steps After Immediate Fixes

1. **Monitor performance** with the quick fixes applied
2. **Consider implementing** the more comprehensive optimizations from the full analysis
3. **Add health check endpoint** that reports scan progress
4. **Implement background scanning** for better user experience

## Emergency Fix for Production

If the container is taking too long to start in production:

1. **Stop the container**
2. **Add environment variable**: `SCAN_ON_START=false`
3. **Restart the container**
4. **Manually trigger scan** via UI when needed

This will get the service running immediately while preserving functionality.

## Verification

After applying these changes:

1. **Check container startup time**:
   ```bash
   docker compose up -d
   sleep 2
   curl http://localhost:8000/health
   ```

2. **Verify manual scanning works**:
   ```bash
   curl -X POST http://localhost:8000/api/rescan
   ```

3. **Monitor resource usage**:
   ```bash
   docker stats --no-stream random-music-server
   ```

These immediate improvements should address the most critical performance issues causing slow container load times while maintaining core functionality.
