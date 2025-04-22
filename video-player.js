/**
 * Video player with Kuroshiro-powered subtitle processing and kanji word highlighting
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
            await this.kuroshiro.init(new this.KuromojiAnalyzerClass());
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
            
            if (!subtitle || !subtitle.text || subtitle.text.trim() === '') {
                this.subtitleDisplay.innerHTML = '';
                this.subtitleArea.style.display = 'none'; // Hide subtitle area when no text
                return;
            }
            
            // Show subtitle area since we have text
            this.subtitleArea.style.display = 'block';
            
            // Process subtitle text
            try {
                const processedText = await this.processSubtitleText(subtitle.text);
                this.subtitleDisplay.innerHTML = processedText;
                
                // After the subtitle is displayed, enhance it with kanji popups
                this.enhanceWithKanjiPopups(subtitle.text);
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
     * Enhance subtitle text with kanji word popups
     * @param {string} originalText - Original subtitle text before furigana conversion
     */
    async enhanceWithKanjiPopups(originalText) {
        try {
            // Initialize segmentedWords array
            let segmentedWords = [];
            
            // Use the existing initialized kuroshiro analyzer instead of creating a new one
            if (this.kuroshiro && this.kuroshiroReady) {
                try {
                    // Get the analyzer from Kuroshiro
                    const analyzer = this.kuroshiro._analyzer;
                    
                    if (analyzer) {
                        // Parse text into tokens using Kuromoji
                        const tokens = await analyzer.parse(originalText);
                        
                        // Filter tokens based on part of speech
                        const targetPos = ["名詞", "動詞", "副詞", "形容詞"];
                        segmentedWords = tokens
                            .filter(token => targetPos.includes(token.pos))
                            .map(token => ({
                                word: token.surface_form,
                                // Convert katakana to hiragana if present
                                reading: this.convertKatakanaToHiragana(token.reading || ""),
                                pos: token.pos
                            }));
                    }
                } catch (error) {
                    console.error("Error tokenizing text:", error.message);
                }
            }
            
            // Process words from Kuromoji analysis
            const kanjiWords = [];
            
            // Keep track of the original positions in the text
            let textIndex = 0;
            for (const wordData of segmentedWords) {
                const word = wordData.word;
                
                // Skip empty words
                if (!word || word.trim() === '') continue;
                
                // Find position of this word - we need to search from start each time to get accurate positioning
                const position = originalText.indexOf(word, textIndex);
                if (position === -1) {
                    // If word not found continuing from last position, try from beginning
                    const posFromStart = originalText.indexOf(word);
                    if (posFromStart === -1) continue; // Skip if word not found at all
                    
                    // Add to word list with position from start
                    const wordObj = {
                        word: word,
                        position: posFromStart,
                        length: word.length,
                        data: {
                            word: word,
                            hiragana: wordData.reading,
                            meaning: null
                        }
                    };
                    
                    kanjiWords.push(wordObj);
                    textIndex = posFromStart + word.length;
                } else {
                    // Add to word list with found position
                    const wordObj = {
                        word: word,
                        position: position,
                        length: word.length,
                        data: {
                            word: word,
                            hiragana: wordData.reading,
                            meaning: null
                        }
                    };
                    
                    kanjiWords.push(wordObj);
                    textIndex = position + word.length;
                }
            }
            
            // Process each word to get its meaning
            for (const wordObj of kanjiWords) {
                try {
                    // Look up meaning
                    await this.lookupWholeWord(wordObj);
                } catch (error) {
                    wordObj.data.meaning = "Error fetching meaning";
                }
            }
            
            if (kanjiWords.length === 0) {
                return; // No words found
            }

            // First convert the original text with furigana using Kuroshiro
            let formattedHTML = await this.processSubtitleText(originalText);
            
            // Create a temporary div to work with the HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedHTML;
            
            // Sort words by position - longer words first to avoid nested highlights
            kanjiWords.sort((a, b) => {
                // First by position
                if (a.position !== b.position) return a.position - b.position;
                // Then by length (longer first)
                return b.length - a.length;
            });
            
            // Apply the overlay highlighting approach
            this.applyHighlighting(tempDiv, kanjiWords, originalText);
            
            // Use the processed HTML
            this.subtitleDisplay.innerHTML = tempDiv.innerHTML;
        } catch (error) {
            console.error("Error enhancing with kanji popups:", error.message);
        }
    }
    
    /**
     * Convert katakana to hiragana
     * @param {string} text - Text that may contain katakana
     * @returns {string} - Text with katakana converted to hiragana
     */
    convertKatakanaToHiragana(text) {
        if (!text) return "";
        
        // Convert katakana to hiragana
        return text.replace(/[\u30A1-\u30F6]/g, function(match) {
            return String.fromCharCode(match.charCodeAt(0) - 0x60);
        });
    }
    
    /**
     * Apply highlighting to all text nodes in the document
     * @param {Node} rootNode - The root DOM node to process
     * @param {Array} kanjiWords - Kanji words to highlight
     * @param {string} originalText - Original text for positional reference
     */
    applyHighlighting(rootNode, kanjiWords, originalText) {
        // Use a different approach - collect all text nodes first
        const textNodes = [];
        this.collectTextNodes(rootNode, textNodes);
        
        // Build a map of words by position for quick lookup
        const wordMap = new Map();
        kanjiWords.forEach(word => {
            const key = word.position + ':' + word.length;
            wordMap.set(key, word);
        });
        
        // Calculate original text positions for each text node
        let currentTextPosition = 0;
        const textNodePositions = new Map();
        
        for (const textNode of textNodes) {
            const text = textNode.nodeValue;
            if (!text) continue;
            
            // Find this text in the original
            const position = originalText.indexOf(text, currentTextPosition);
            if (position !== -1) {
                textNodePositions.set(textNode, position);
                currentTextPosition = position + text.length;
            }
        }
        
        // Now process each text node to add highlights
        for (const textNode of textNodes) {
            const text = textNode.nodeValue;
            if (!text || text.trim() === '') continue;
            
            // Find words that overlap with this text node's position
            const nodePosition = textNodePositions.get(textNode) || 0;
            const nodeEndPosition = nodePosition + text.length;
            
            // Find words that are contained within this text node
            const relevantWords = kanjiWords.filter(word => {
                const wordEndPosition = word.position + word.length;
                return (
                    // Word starts within this text node
                    (word.position >= nodePosition && word.position < nodeEndPosition) ||
                    // Word overlaps with start of this text node
                    (word.position < nodePosition && wordEndPosition > nodePosition)
                );
            }).sort((a, b) => {
                // Sort by adjusted position within this text node
                return (a.position - nodePosition) - (b.position - nodePosition);
            });
            
            if (relevantWords.length === 0) continue;
            
            // Create fragments to replace this node
            const fragments = [];
            let lastIndex = 0;
            
            // Process words in this text node
            for (const wordObj of relevantWords) {
                // Calculate the adjusted position of this word within the text node
                const wordStartInNode = Math.max(0, wordObj.position - nodePosition);
                
                // Skip if word would start after this node ends
                if (wordStartInNode >= text.length) continue;
                
                // Calculate how much of the word fits in this text node
                const availableLength = text.length - wordStartInNode;
                const wordLengthInNode = Math.min(wordObj.length, availableLength);
                
                // Skip if position would be invalid
                if (wordStartInNode < 0 || wordLengthInNode <= 0) continue;
                
                // Add text before the word
                if (wordStartInNode > lastIndex) {
                    fragments.push(document.createTextNode(text.substring(lastIndex, wordStartInNode)));
                }
                
                // Get the actual word text from this node (might be partial)
                const wordText = text.substr(wordStartInNode, wordLengthInNode);
                
                // Create a span for the word
                const wordSpan = document.createElement('span');
                wordSpan.className = 'kanji-word';
                wordSpan.textContent = wordText;
                
                // Create popup with meaning
                const popup = document.createElement('span');
                popup.className = 'kanji-popup';
                
                // Format popup content
                if (wordObj.data) {
                    const content = [];
                    if (wordObj.data.hiragana) {
                        content.push(wordObj.data.hiragana);
                    }
                    if (wordObj.data.meaning) {
                        content.push(wordObj.data.meaning);
                    }
                    popup.textContent = content.join(' - ');
                } else {
                    popup.textContent = 'No meaning available';
                }
                
                wordSpan.appendChild(popup);
                fragments.push(wordSpan);
                
                // Update last index
                lastIndex = wordStartInNode + wordLengthInNode;
            }
            
            // Add any remaining text
            if (lastIndex < text.length) {
                fragments.push(document.createTextNode(text.substring(lastIndex)));
            }
            
            // Only replace if we found words
            if (fragments.length > 0 && lastIndex > 0) {
                // Create a fragment to hold all the new nodes
                const fragment = document.createDocumentFragment();
                fragments.forEach(f => fragment.appendChild(f));
                
                // Replace the original text node with our fragments
                const parent = textNode.parentNode;
                if (parent) {
                    parent.replaceChild(fragment, textNode);
                }
            }
        }
    }
    
    /**
     * Collect all text nodes under a root node
     * @param {Node} node - The node to process
     * @param {Array} textNodes - Array to store text nodes
     */
    collectTextNodes(node, textNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            // If it's a non-empty text node, add it to our collection
            if (node.nodeValue && node.nodeValue.trim() !== '') {
                textNodes.push(node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip RT elements (readings in ruby annotations)
            if (node.nodeName.toLowerCase() === 'rt' || node.nodeName.toLowerCase() === 'rp') {
                return;
            }
            
            // Recurse for other elements
            for (let i = 0; i < node.childNodes.length; i++) {
                this.collectTextNodes(node.childNodes[i], textNodes);
            }
        }
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
    
    /**
     * Look up meaning for a whole word using API
     * @param {Object} wordObj - The word object to add meaning to
     */
    async lookupWholeWord(wordObj) {
        const word = wordObj.word;
        
        try {
            // Try inflected search first
            const inflectedUrl = `http://localhost:3000/search/inflected?q=${encodeURIComponent(word)}`;
            const response = await fetch(inflectedUrl);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.matches && data.matches.length > 0) {
                    // First, look for exact match with non-empty meaning
                    const exactMatchWithMeaning = data.matches.find(m => 
                        m.word === word && m.meaning && m.meaning.trim() !== ''
                    );
                    
                    if (exactMatchWithMeaning) {
                        wordObj.data.meaning = exactMatchWithMeaning.meaning;
                        return;
                    }
                    
                    // Next, look for any match with non-empty meaning
                    const anyMatchWithMeaning = data.matches.find(m => 
                        m.meaning && m.meaning.trim() !== ''
                    );
                    
                    if (anyMatchWithMeaning) {
                        wordObj.data.meaning = anyMatchWithMeaning.meaning;
                        return;
                    }
                    
                    // Use first match as last resort
                    if (data.matches[0].meaning) {
                        wordObj.data.meaning = data.matches[0].meaning;
                    }
                }
            }
            
            // If inflected search failed or no meaning found, try direct search
            const directUrl = `http://localhost:3000/search?q=${encodeURIComponent(word)}`;
            const directResponse = await fetch(directUrl);
            
            if (directResponse.ok) {
                const directData = await directResponse.json();
                if (directData.matches && directData.matches.length > 0) {
                    // Look for matches with non-empty meaning
                    const matchWithMeaning = directData.matches.find(m => 
                        m.meaning && m.meaning.trim() !== ''
                    );
                    
                    if (matchWithMeaning) {
                        wordObj.data.meaning = matchWithMeaning.meaning;
                        return;
                    }
                }
            }
            
            // If both inflected and direct search failed, try partial search
            const partialUrl = `http://localhost:3000/search/partial?q=${encodeURIComponent(word)}&limit=5`;
            const partialResponse = await fetch(partialUrl);
            
            if (partialResponse.ok) {
                const partialData = await partialResponse.json();
                
                if (partialData.matches && partialData.matches.length > 0) {
                    // Look for exact match with non-empty meaning
                    const exactPartialMatch = partialData.matches.find(m => 
                        m.word === word && m.meaning && m.meaning.trim() !== ''
                    );
                    
                    if (exactPartialMatch) {
                        wordObj.data.meaning = exactPartialMatch.meaning;
                        return;
                    }
                    
                    // Look for any match with meaning
                    const anyPartialMatchWithMeaning = partialData.matches.find(m => 
                        m.meaning && m.meaning.trim() !== ''
                    );
                    
                    if (anyPartialMatchWithMeaning) {
                        wordObj.data.meaning = anyPartialMatchWithMeaning.meaning;
                        return;
                    }
                }
            }
            
            // If all else fails, set a default meaning
            if (!wordObj.data.meaning || wordObj.data.meaning.trim() === '') {
                wordObj.data.meaning = "No definition found";
            }
        } catch (error) {
            console.error(`Error in lookupWholeWord for "${word}":`, error);
            wordObj.data.meaning = "Error fetching meaning";
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