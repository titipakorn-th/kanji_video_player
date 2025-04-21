/**
 * Video player with Kuroshiro-powered subtitle processing
 */
class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('video-player');
        this.subtitleDisplay = document.getElementById('subtitle-display');
        this.videoInput = document.getElementById('video-input');
        this.subtitleInput = document.getElementById('subtitle-input');
        this.playButton = document.getElementById('play-btn');
        this.pauseButton = document.getElementById('pause-btn');
        this.loadingStatus = document.getElementById('loading-status');
        this.videoContainer = document.querySelector('.video-container');
        this.subtitleArea = document.querySelector('.subtitle-area');
        this.fullscreenButton = document.getElementById('fullscreen-btn');
        
        this.kuroshiro = null;
        this.currentSubtitle = null;
        this.subtitles = [];
        this.kuroshiroReady = false;
        
        // Get Kuroshiro class - might be exposed in different ways depending on how it's loaded
        this.KuroshiroClass = typeof Kuroshiro !== 'undefined' ? Kuroshiro : window.Kuroshiro;
        this.KuromojiAnalyzerClass = typeof KuromojiAnalyzer !== 'undefined' ? KuromojiAnalyzer : window.KuromojiAnalyzer;
        
        if (!this.KuroshiroClass || !this.KuromojiAnalyzerClass) {
            this.loadingStatus.textContent = "Error: Kuroshiro libraries not available. Check console.";
            console.error("Kuroshiro or KuromojiAnalyzer not found. Make sure the scripts are loaded properly.");
            return;
        }
        
        this.initializeKuroshiro();
        this.setupEventListeners();
    }
    
    /**
     * Initialize Kuroshiro for kanji conversion
     */
    async initializeKuroshiro() {
        try {
            this.loadingStatus.textContent = "Initializing Kuroshiro dictionary...";
            this.kuroshiro = new this.KuroshiroClass();
            await this.kuroshiro.init(new this.KuromojiAnalyzerClass({ dictPath: './kuromoji/dict' }));
            this.kuroshiroReady = true;
            this.loadingStatus.textContent = "Kuroshiro ready";
            setTimeout(() => {
                this.loadingStatus.textContent = "";
            }, 3000);
        } catch (error) {
            console.error("Error initializing Kuroshiro:", error);
            this.loadingStatus.textContent = "Error loading Kuroshiro: " + error.message;
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Video file selection
        this.videoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const videoURL = URL.createObjectURL(file);
                this.videoElement.src = videoURL;
                this.loadingStatus.textContent = `Loaded video: ${file.name}`;
                setTimeout(() => {
                    this.loadingStatus.textContent = "";
                }, 3000);
            }
        });
        
        // Subtitle file selection
        this.subtitleInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.loadSubtitles(event.target.result);
                };
                reader.readAsText(file);
            }
        });
        
        // Video time update - check for subtitles
        this.videoElement.addEventListener('timeupdate', () => {
            this.checkSubtitles();
        });
        
        // Control buttons
        this.playButton.addEventListener('click', () => this.videoElement.play());
        this.pauseButton.addEventListener('click', () => this.videoElement.pause());
        
        // Fullscreen button
        this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        
        // Error handling for video
        this.videoElement.addEventListener('error', (e) => {
            console.error("Video error:", this.videoElement.error);
            this.loadingStatus.textContent = `Video error: ${this.videoElement.error?.message || "Unknown error"}`;
        });
        
        // Fullscreen change event
        this.videoElement.addEventListener('dblclick', () => this.toggleFullscreen());
        
        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
    }
    
    /**
     * Load and parse subtitles
     * @param {string} content - Subtitle file content
     */
    loadSubtitles(content) {
        this.subtitles = subtitleParser.parseSRT(content);
        this.loadingStatus.textContent = `Loaded ${this.subtitles.length} subtitles`;
        setTimeout(() => {
            this.loadingStatus.textContent = "";
        }, 3000);
    }
    
    /**
     * Check for subtitles at current video time
     */
    async checkSubtitles() {
        const currentTime = this.videoElement.currentTime * 1000; // Convert to ms
        const subtitle = subtitleParser.findSubtitleAtTime(currentTime);
        
        // If subtitle changed or no subtitle now
        if (subtitle !== this.currentSubtitle) {
            this.currentSubtitle = subtitle;
            
            if (!subtitle) {
                this.subtitleDisplay.innerHTML = '';
                return;
            }
            
            // Process subtitle text
            try {
                const processedText = await this.processSubtitleText(subtitle.text);
                this.subtitleDisplay.innerHTML = processedText;
            } catch (error) {
                console.error("Error processing subtitle:", error);
                this.subtitleDisplay.textContent = subtitle.text;
            }
        }
    }
    
    /**
     * Process subtitle text - convert kanji to furigana if needed
     * @param {string} text - Subtitle text
     * @returns {string} - Processed text with furigana
     */
    async processSubtitleText(text) {
        if (!this.kuroshiro || !this.kuroshiroReady) {
            return text;
        }
        
        try {
            // Check if text contains kanji using available Kuroshiro
            const util = this.KuroshiroClass.Util;
            if (util && util.hasKanji(text)) {
                // Convert text with kanji to furigana
                return await this.kuroshiro.convert(text, {mode: "furigana", to: "hiragana"});
            }
        } catch (error) {
            console.error("Error in Kuroshiro conversion:", error);
        }
        
        return text;
    }
    
    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!document.fullscreenElement && 
            !document.mozFullScreenElement && 
            !document.webkitFullscreenElement && 
            !document.msFullscreenElement) {
            // Enter fullscreen
            if (this.videoContainer.requestFullscreen) {
                this.videoContainer.requestFullscreen();
            } else if (this.videoContainer.mozRequestFullScreen) {
                this.videoContainer.mozRequestFullScreen();
            } else if (this.videoContainer.webkitRequestFullscreen) {
                this.videoContainer.webkitRequestFullscreen();
            } else if (this.videoContainer.msRequestFullscreen) {
                this.videoContainer.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
    
    /**
     * Handle fullscreen change event
     */
    handleFullscreenChange() {
        const isFullscreen = document.fullscreenElement || 
                            document.mozFullScreenElement || 
                            document.webkitFullscreenElement || 
                            document.msFullscreenElement;
        
        if (isFullscreen) {
            // Adjust subtitle styling for fullscreen mode
            this.subtitleArea.style.fontSize = '28px';
            this.subtitleArea.style.bottom = '80px';
        } else {
            // Restore subtitle styling for normal mode
            this.subtitleArea.style.fontSize = '20px';
            this.subtitleArea.style.bottom = '50px';
        }
    }
}

// Initialize video player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make sure the Kuroshiro scripts have had time to load
    setTimeout(() => {
        const player = new VideoPlayer();
    }, 500);
}); 