/**
 * Client-side queue manager for Random Music Server
 * Manages personal queue batches with localStorage persistence
 */

class ClientQueueManager {
    constructor(config = {}) {
        // Configuration
        this.batchSize = config.batchSize || 50;
        this.prefetchThreshold = config.prefetchThreshold || 10;
        this.storageKey = config.storageKey || 'randomMusicQueue';
        this.autoPrefetch = config.autoPrefetch !== false;
        this.confirmSettingsChange = config.confirmSettingsChange !== false;
        
        // State
        this.batch = [];
        this.position = 0;
        this.batchId = null;
        this.settings = {
            mode: 'full_random',
            time_margin_days: 7,
            date_type: 'mtime'
        };
        this.generatedAt = null;
        this.totalAvailable = 0;
        
        // Initialize
        this.loadFromStorage();
    }
    
    // Storage methods
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                
                // Validate stored data
                if (data.batch && Array.isArray(data.batch)) {
                    this.batch = data.batch;
                    this.position = data.position || 0;
                    this.batchId = data.batchId || null;
                    this.settings = data.settings || this.settings;
                    this.generatedAt = data.generatedAt || null;
                    this.totalAvailable = data.totalAvailable || 0;
                    
                    // Ensure position is within bounds
                    if (this.position >= this.batch.length) {
                        this.position = Math.max(0, this.batch.length - 1);
                    }
                    
                    console.log('Loaded queue from storage:', {
                        batchSize: this.batch.length,
                        position: this.position,
                        settings: this.settings
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load queue from storage:', error);
            this.clearStorage();
        }
    }
    
    saveToStorage() {
        try {
            const data = {
                batch: this.batch,
                position: this.position,
                batchId: this.batchId,
                settings: this.settings,
                generatedAt: this.generatedAt,
                totalAvailable: this.totalAvailable,
                savedAt: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save queue to storage:', error);
        }
    }
    
    clearStorage() {
        localStorage.removeItem(this.storageKey);
        this.batch = [];
        this.position = 0;
        this.batchId = null;
    }
    
    // Queue navigation
    currentTrackId() {
        if (!this.batch.length || this.position >= this.batch.length) {
            return null;
        }
        return this.batch[this.position];
    }
    
    next() {
        if (!this.batch.length) {
            return null;
        }
        
        this.position++;
        
        // Wrap around if at end
        if (this.position >= this.batch.length) {
            this.position = 0;
        }
        
        this.saveToStorage();
        this.checkPrefetch();
        
        return this.currentTrackId();
    }
    
    prev() {
        if (!this.batch.length) {
            return null;
        }
        
        this.position--;
        
        // Wrap around if at beginning
        if (this.position < 0) {
            this.position = this.batch.length - 1;
        }
        
        this.saveToStorage();
        
        return this.currentTrackId();
    }
    
    jumpTo(trackId) {
        const index = this.batch.indexOf(trackId);
        if (index !== -1) {
            this.position = index;
            this.saveToStorage();
            return trackId;
        }
        return null;
    }
    
    // Batch management
    async fetchNewBatch(settings = null) {
        try {
            // Use provided settings or current settings
            const requestSettings = settings || this.settings;
            
            const response = await fetch('/api/queue/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    size: this.batchSize,
                    mode: requestSettings.mode,
                    time_margin_days: requestSettings.time_margin_days,
                    date_type: requestSettings.date_type,
                    seed: this.generateSeed()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            
            const data = await response.json();
            
            // Update state
            this.batch = data.track_ids;
            this.batchId = data.batch_id;
            this.generatedAt = data.generated_at;
            this.totalAvailable = data.total_available;
            this.settings = data.settings;
            this.position = 0;
            
            this.saveToStorage();
            
            console.log('Fetched new batch:', {
                size: this.batch.length,
                batchId: this.batchId,
                settings: this.settings
            });
            
            return true;
        } catch (error) {
            console.error('Failed to fetch new batch:', error);
            return false;
        }
    }
    
    async prefetchNextBatch() {
        if (!this.autoPrefetch) {
            return;
        }
        
        // Don't prefetch if already at the end of a very small batch
        if (this.batch.length <= this.prefetchThreshold) {
            return;
        }
        
        try {
            // Prefetch in background
            const response = await fetch('/api/queue/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    size: this.batchSize,
                    mode: this.settings.mode,
                    time_margin_days: this.settings.time_margin_days,
                    date_type: this.settings.date_type,
                    seed: this.generateSeed() + '_prefetch'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Prefetched next batch:', {
                    size: data.track_ids.length,
                    batchId: data.batch_id
                });
                
                // Store prefetched batch for later use
                localStorage.setItem(`${this.storageKey}_prefetch`, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to prefetch batch:', error);
        }
    }
    
    checkPrefetch() {
        if (!this.batch.length || !this.autoPrefetch) {
            return;
        }
        
        const remaining = this.batch.length - this.position - 1;
        if (remaining <= this.prefetchThreshold) {
            this.prefetchNextBatch();
        }
    }
    
    usePrefetchedBatch() {
        try {
            const prefetched = localStorage.getItem(`${this.storageKey}_prefetch`);
            if (prefetched) {
                const data = JSON.parse(prefetched);
                
                // Switch to prefetched batch
                this.batch = data.track_ids;
                this.batchId = data.batch_id;
                this.generatedAt = data.generated_at;
                this.totalAvailable = data.total_available;
                this.settings = data.settings;
                this.position = 0;
                
                // Clear prefetched data
                localStorage.removeItem(`${this.storageKey}_prefetch`);
                
                this.saveToStorage();
                
                console.log('Switched to prefetched batch');
                return true;
            }
        } catch (error) {
            console.error('Failed to use prefetched batch:', error);
        }
        return false;
    }
    
    // Settings management
    updateSettings(newSettings) {
        const changed = JSON.stringify(this.settings) !== JSON.stringify(newSettings);
        this.settings = { ...newSettings };
        
        if (changed) {
            this.saveToStorage();
        }
        
        return changed;
    }
    
    async changeSettings(newSettings) {
        const oldSettings = { ...this.settings };
        
        if (this.confirmSettingsChange && this.batch.length > 0) {
            // In a real app, you would show a confirmation dialog
            // For now, we'll just log and proceed
            console.log('Settings changed, fetching new batch...');
        }
        
        this.updateSettings(newSettings);
        const success = await this.fetchNewBatch();
        
        if (!success) {
            // Revert on failure
            this.updateSettings(oldSettings);
            return false;
        }
        
        return true;
    }
    
    // Utility methods
    generateSeed() {
        // Generate a seed based on current time and random value
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getQueueWindow(windowSize = 10) {
        if (!this.batch.length) {
            return [];
        }
        
        const start = Math.max(0, this.position - 4);
        const end = Math.min(this.batch.length, start + windowSize);
        
        const window = [];
        for (let i = start; i < end; i++) {
            window.push({
                id: this.batch[i],
                position: i,
                is_current: i === this.position
            });
        }
        
        return window;
    }
    
    getProgress() {
        if (!this.batch.length) {
            return { position: 0, total: 0, remaining: 0, percent: 0 };
        }
        
        return {
            position: this.position,
            total: this.batch.length,
            remaining: this.batch.length - this.position - 1,
            percent: ((this.position + 1) / this.batch.length) * 100
        };
    }
    
    getBatchInfo() {
        return {
            batchId: this.batchId,
            generatedAt: this.generatedAt,
            settings: this.settings,
            totalAvailable: this.totalAvailable
        };
    }
    
    // Initialization
    async initialize() {
        // Load existing queue
        this.loadFromStorage();
        
        // If no batch exists, fetch one
        if (!this.batch.length) {
            console.log('No existing batch, fetching initial batch...');
            await this.fetchNewBatch();
        } else {
            console.log('Using existing batch:', {
                size: this.batch.length,
                position: this.position
            });
        }
        
        // Check if we need to prefetch
        this.checkPrefetch();
        
        return this.currentTrackId();
    }
    
    // Reset
    reset() {
        this.clearStorage();
        return this.initialize();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientQueueManager;
}
