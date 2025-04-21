/**
 * Parse SRT subtitle files
 */
class SubtitleParser {
    constructor() {
        this.subtitles = [];
    }

    /**
     * Parse SRT file content
     * @param {string} content - SRT file content
     * @returns {Array} - Array of subtitle objects with start, end, and text properties
     */
    parseSRT(content) {
        this.subtitles = [];
        
        // Normalize line breaks to handle different formats
        const normalizedContent = content.replace(/\r\n|\r|\n/g, '\n');
        
        // Split by double newline to get subtitle blocks
        const subtitleBlocks = normalizedContent.trim().split('\n\n');
        
        for (const block of subtitleBlocks) {
            // Parse each subtitle block
            const lines = block.split('\n');
            
            // Skip empty blocks
            if (lines.length < 3) continue;
            
            // Skip index number and get to timestamp line
            let timestampLine = lines[1];
            
            // Parse timestamp line (format: 00:00:00,000 --> 00:00:00,000)
            const timeMatch = timestampLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
            if (!timeMatch) continue;
            
            const startTime = this.timeToMilliseconds(timeMatch[1]);
            const endTime = this.timeToMilliseconds(timeMatch[2]);
            
            // Join all text lines
            const text = lines.slice(2).join(' ');
            
            this.subtitles.push({
                start: startTime,
                end: endTime,
                text: text
            });
        }
        
        return this.subtitles;
    }
    
    /**
     * Convert SRT timestamp to milliseconds
     * @param {string} timeString - SRT timestamp (format: 00:00:00,000)
     * @returns {number} - Milliseconds
     */
    timeToMilliseconds(timeString) {
        const [time, milliseconds] = timeString.split(',');
        const [hours, minutes, seconds] = time.split(':').map(Number);
        
        return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(milliseconds);
    }
    
    /**
     * Find subtitle for a specific timestamp
     * @param {number} time - Current video time in milliseconds
     * @returns {object|null} - Subtitle object or null if no subtitle for this time
     */
    findSubtitleAtTime(time) {
        return this.subtitles.find(subtitle => 
            time >= subtitle.start && time <= subtitle.end
        ) || null;
    }
}

// Create global instance
const subtitleParser = new SubtitleParser(); 