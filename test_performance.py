#!/usr/bin/env python3
"""
Performance test script for Random Music Server library scanning.
This script demonstrates the performance impact of different scanning approaches.
"""

import os
import time
import subprocess
import tempfile
import hashlib
from pathlib import Path

def create_test_structure(base_dir: Path, num_folders: int = 10, files_per_folder: int = 5):
    """Create a test directory structure with dummy audio files."""
    print(f"Creating test structure with {num_folders} folders, {files_per_folder} files each...")
    
    for i in range(num_folders):
        folder = base_dir / f"album_{i:03d}"
        folder.mkdir(exist_ok=True)
        
        # Create some dummy files
        for j in range(files_per_folder):
            file_path = folder / f"track_{j:02d}.mp3"
            file_path.write_text(f"Dummy audio content for track {j} in album {i}")
            
        # Create a cover image in some folders
        if i % 3 == 0:
            cover_path = folder / "cover.jpg"
            cover_path.write_text(f"Dummy cover for album {i}")
    
    print(f"Created {num_folders * files_per_folder} dummy files")
    return num_folders * files_per_folder

def test_subprocess_stat(folder_path: Path):
    """Test the current inefficient subprocess approach."""
    start = time.time()
    count = 0
    
    for root, dirs, files in os.walk(folder_path):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            try:
                result = subprocess.run(
                    ['stat', '-c', '%W', dir_path],
                    capture_output=True,
                    text=True,
                    check=False
                )
                if result.returncode == 0:
                    btime_str = result.stdout.strip()
                    if btime_str and btime_str != '0':
                        btime = float(btime_str)
                        count += 1
            except (OSError, ValueError):
                pass
    
    elapsed = time.time() - start
    print(f"  Subprocess stat: {count} folders in {elapsed:.3f}s ({elapsed/max(count,1):.4f}s per folder)")
    return elapsed

def test_native_stat(folder_path: Path):
    """Test the optimized native Python approach."""
    start = time.time()
    count = 0
    
    for root, dirs, files in os.walk(folder_path):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            try:
                stat_info = os.stat(dir_path)
                # Try to get birth time (available on some systems)
                btime = getattr(stat_info, 'st_birthtime', None)
                if btime is None:
                    # Fall back to creation time
                    btime = stat_info.st_ctime
                count += 1
            except (OSError, AttributeError):
                pass
    
    elapsed = time.time() - start
    print(f"  Native os.stat:  {count} folders in {elapsed:.3f}s ({elapsed/max(count,1):.4f}s per folder)")
    return elapsed

def test_track_id_generation(folder_path: Path, num_files: int = 50):
    """Test SHA1 hash generation for track IDs."""
    print(f"\nTesting track ID generation for {num_files} files...")
    
    # Create some dummy file paths
    file_paths = []
    for i in range(num_files):
        rel_path = f"album_{i//5}/track_{i%5}.mp3"
        file_paths.append(rel_path)
    
    # Test SHA1 generation
    start = time.time()
    for rel_path in file_paths:
        track_id = hashlib.sha1(rel_path.encode("utf-8")).hexdigest()
    
    elapsed = time.time() - start
    print(f"  SHA1 generation: {num_files} hashes in {elapsed:.3f}s ({elapsed/num_files:.6f}s per hash)")
    return elapsed

def simulate_library_scan(folder_path: Path):
    """Simulate the library scanning process."""
    print("\nSimulating library scan process...")
    
    total_start = time.time()
    
    # Directory traversal
    start = time.time()
    folder_count = 0
    file_count = 0
    
    for root, dirs, files in os.walk(folder_path):
        folder_count += 1
        audio_files = [f for f in files if f.endswith(('.mp3', '.flac'))]
        file_count += len(audio_files)
    
    traversal_time = time.time() - start
    print(f"  Directory traversal: {folder_count} folders, {file_count} audio files in {traversal_time:.3f}s")
    
    # Metadata extraction simulation (dummy)
    start = time.time()
    metadata_time = file_count * 0.001  # Simulate 1ms per file
    time.sleep(min(metadata_time, 0.5))  # Cap at 0.5s for demo
    
    print(f"  Metadata extraction: {file_count} files in ~{metadata_time:.3f}s (simulated)")
    
    total_time = time.time() - total_start
    print(f"\n  Total simulated scan time: {total_time:.3f}s")
    
    return total_time

def main():
    print("=" * 60)
    print("Random Music Server Performance Test")
    print("=" * 60)
    
    # Create temporary directory for testing
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        # Create test structure
        total_files = create_test_structure(tmp_path, num_folders=20, files_per_folder=8)
        
        print("\n" + "=" * 60)
        print("Testing folder stat performance...")
        print("-" * 60)
        
        # Test both approaches
        subprocess_time = test_subprocess_stat(tmp_path)
        native_time = test_native_stat(tmp_path)
        
        speedup = subprocess_time / native_time if native_time > 0 else 0
        print(f"\n  Speedup: {speedup:.1f}x faster with native approach")
        
        # Test other operations
        test_track_id_generation(tmp_path, 100)
        simulate_library_scan(tmp_path)
        
        print("\n" + "=" * 60)
        print("Performance Recommendations:")
        print("-" * 60)
        print("1. Replace subprocess stat calls with os.stat()")
        print("2. Consider disabling birth time collection if not needed")
        print("3. Implement metadata caching for repeated scans")
        print("4. Add SCAN_ON_START=false for faster container startup")
        print("=" * 60)

if __name__ == "__main__":
    main()
