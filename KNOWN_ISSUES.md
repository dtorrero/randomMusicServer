# Known Issues

This document tracks known issues, bugs, and limitations in the Random Music Server. Each issue includes a description, impact, and any available workarounds.

## Issue #1: Root Folder Files Have Incorrect Modification Dates

### Description
Files located directly in the root music directory (not in subfolders) receive incorrect modification dates in the "recent albums" mode. This occurs because the system uses folder modification times (`folder_mtime`) for date-based filtering, and for root folder files, the folder is the music directory itself.

### Root Cause
In `app/library.py`, the `scan_library()` function determines folder modification time using `os.path.getmtime(root)` where `root` is the current directory being scanned. When scanning the root music directory, `root` equals the music directory path. The modification time of the music directory is assigned to all files directly within it, rather than using individual file modification times.

### Impact
- **Recent Albums Mode**: Files in the root folder may not appear in "recent albums" filtering or may appear incorrectly based on the music directory's modification time rather than the actual file's modification time.
- **Date-based Filtering**: The "mtime" (modification time) and "btime" (birth time) settings in recent albums mode will be inaccurate for root folder files.

### Affected Code
- `app/library.py`: `scan_library()` function, lines 85-115 (folder_mtime assignment)
- `app/player.py`: `_reshuffle_locked()` function uses `track.folder_mtime` for recent albums filtering

### Workaround
1. **Organize files into subfolders**: Place music files in subfolders within the music directory. This ensures each folder has its own modification time.
2. **Use full random mode**: Disable "recent albums" mode to avoid date-based filtering issues.
3. **Manual library rescan**: After modifying files in the root folder, consider rescanning the library to update folder modification times.

### Potential Fix
A potential fix would be to treat root folder files specially by using individual file modification times instead of the parent folder's modification time. This would require modifying the `scan_library()` function to detect when `folder_rel == "."` and use file-specific modification times for those tracks.

### Status
**Open** - Issue identified, workarounds available.

---

## Issue Reporting
To report a new issue, please:
1. Check if the issue is already documented here
2. Review existing documentation for solutions
3. If the issue is new, create a GitHub issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Docker/Podman, OS, library size)

## Issue Prioritization
Issues are prioritized based on:
1. **Critical**: Security vulnerabilities, data loss, complete service failure
2. **High**: Major functionality broken, significant performance degradation
3. **Medium**: Minor functionality issues, UI problems, documentation gaps
4. **Low**: Cosmetic issues, minor edge cases

## Version History
- **2026-06-01**: Initial document created with Issue #1
