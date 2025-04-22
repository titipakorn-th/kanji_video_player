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
            
            if (!subtitle) {
                this.subtitleDisplay.innerHTML = '';
                return;
            }
            
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
            // Log the original text before any processing
            console.log("Original subtitle text:", originalText);
            
            // First, get the current HTML which contains ruby elements with furigana
            const currentHTML = this.subtitleDisplay.innerHTML;
            console.log("Original HTML with ruby tags:", currentHTML);
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = currentHTML;
            
            // Extract kanji words from ruby elements - these are already identified words with readings
            const rubyElements = tempDiv.querySelectorAll('ruby');
            const rubyWords = [];
            
            // Log all ruby elements found
            console.log(`Found ${rubyElements.length} ruby elements in the subtitle`);
            
            // Map to store word data for quick lookup
            const wordDataMap = new Map();
            
            // Process ruby elements - they're already identified as words
            for (const ruby of rubyElements) {
                console.log("Ruby element content:", ruby.outerHTML);
                const baseText = this.getRubyBase(ruby);
                if (baseText && baseText.trim() !== '') {
                    // Clean the word to remove any parentheses
                    const word = baseText.trim().replace(/[()]/g, '');
                    
                    // Skip duplicates
                    if (rubyWords.some(w => w.word === word)) {
                        continue;
                    }
                    
                    // Get the reading from the rt element
                    const rtElement = ruby.querySelector('rt');
                    const reading = rtElement ? rtElement.textContent.trim() : '';
                    
                    // Find the position in the original text
                    let position = originalText.indexOf(word);
                    // Even if not found in original text, process it anyway
                    if (position === -1) {
                        console.log(`Word "${word}" not found in original text, using default position`);
                        position = 0; // Use a default position
                    } else {
                        console.log(`Found ruby element for kanji word: "${word}" with reading: "${reading}" at position ${position}`);
                    }
                    
                    // Extract individual kanji characters from the word
                    const kanjiChars = [];
                    for (let i = 0; i < word.length; i++) {
                        const char = word.charAt(i);
                        // Basic check for kanji
                        if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(char)) {
                            kanjiChars.push(char);
                        }
                    }
                    
                    console.log(`Kanji characters in "${word}":`, kanjiChars);
                    
                    // Store the word with its position
                    rubyWords.push({
                        word: word,
                        position: position,
                        length: word.length,
                        kanjiChars: kanjiChars,
                        data: {
                            word: word,
                            hiragana: reading,
                            meaning: null // We'll fetch this from the API
                        }
                    });
                    
                    // Store in map for later lookup
                    wordDataMap.set(word, rubyWords[rubyWords.length - 1]);
                }
            }
            
            // Get meanings for ruby words using search/inflected
            if (rubyWords.length > 0) {
                console.log(`Looking up meanings for ${rubyWords.length} ruby words`);
                
                // Process each ruby word to get its meaning
                for (const wordObj of rubyWords) {
                    const word = wordObj.word;
                    try {
                        // Instead of looking up the whole word, let's look up each kanji
                        if (wordObj.kanjiChars && wordObj.kanjiChars.length > 0) {
                            console.log(`Looking up individual kanji for "${word}": ${wordObj.kanjiChars.join(', ')}`);
                            
                            // Use the buildMeaningFromKanji method instead of inline lookup
                            await this.buildMeaningFromKanji(wordObj);
                        } else {
                            // No kanji found, try direct API lookup
                            await this.lookupWholeWord(wordObj);
                        }
                    } catch (error) {
                        console.error(`Error processing word "${word}":`, error);
                        wordObj.data.meaning = "Error fetching meaning";
                    }
                }
            }
            
            // Look for additional kanji words in the text not covered by ruby elements
            console.log("Looking for additional kanji words not covered by ruby elements");
            
            // Get kanji words from the text
            const expectedWords = rubyWords.map(w => w.word);
            console.log("Expected words from ruby elements:", expectedWords);
            const kanjiWords = await kanjiDictionary.findKanjiWords(originalText, expectedWords);
            
            // Combine ruby words and additional detected words
            const allWords = [...rubyWords];
            
            // Add newly found words that aren't ruby words
            for (const word of kanjiWords) {
                if (!wordDataMap.has(word.word)) {
                    allWords.push(word);
                    wordDataMap.set(word.word, word);
                }
            }
            
            if (allWords.length === 0) {
                console.log("No kanji words found in subtitle");
                return; // No kanji words found
            }
            
            console.log(`Found ${allWords.length} total kanji words in subtitle:`, allWords.map(w => w.word));
            
            // Sort words by position
            allWords.sort((a, b) => a.position - b.position);
            
            // Create a document fragment to hold our modified content
            const fragment = document.createDocumentFragment();
            
            // Process the DOM to add popups while preserving furigana
            this.processTextNodesForKanji(tempDiv, fragment, allWords);
            
            // Replace the content
            this.subtitleDisplay.innerHTML = '';
            this.subtitleDisplay.appendChild(fragment);
        } catch (error) {
            console.error("Error enhancing with kanji popups:", error);
        }
    }
    
    /**
     * Build a meaning for a word from its individual kanji characters
     * @param {Object} wordObj - The word object to add meaning to
     */
    async buildMeaningFromKanji(wordObj) {
        console.log(`No longer looking up individual kanji for "${wordObj.word}"`);
        
        // Try to look up the whole word instead
        await this.lookupWholeWord(wordObj);
        
        // If lookupWholeWord didn't find a meaning, set a default
        if (!wordObj.data.meaning) {
            wordObj.data.meaning = "No definition available";
        }
    }
    
    /**
     * Process text nodes to add kanji popups while preserving ruby annotations
     * @param {Node} node - Current DOM node
     * @param {DocumentFragment} fragment - Document fragment to build result
     * @param {Array} kanjiWords - Array of kanji words with positions
     */
    processTextNodesForKanji(node, fragment, kanjiWords) {
        // Process recursively for all node types to preserve structure
        this.processNode(node, fragment, kanjiWords);
    }
    
    /**
     * Process a DOM node and its children to add kanji popups
     * @param {Node} node - The node to process
     * @param {DocumentFragment} fragment - Fragment to append processed content to
     * @param {Array} kanjiWords - Array of kanji words to highlight
     */
    processNode(node, fragment, kanjiWords) {
        if (!node) return;
        
        // Clone node if it's not a text node
        if (node.nodeType !== Node.TEXT_NODE) {
            const isRuby = node.nodeName.toLowerCase() === 'ruby';
            const isRt = node.nodeName.toLowerCase() === 'rt';
            
            // Skip ruby processing if it's an rt element (reading part)
            if (isRt) {
                const clone = node.cloneNode(true);
                fragment.appendChild(clone);
                return;
            }
            
            // For ruby elements, we need special handling
            if (isRuby) {
                // For ruby, we need to check if it contains any kanji words
                // If it does, we'll wrap the ruby in a kanji-word span
                const rubyText = node.textContent.replace(/\s+/g, ''); // Remove whitespace
                const rubyBase = this.getRubyBase(node);
                
                // Check if any kanji word matches this ruby element
                const matchingKanjiWord = kanjiWords.find(kw => 
                    rubyBase === kw.word || rubyBase.includes(kw.word) || kw.word.includes(rubyBase)
                );
                
                if (matchingKanjiWord) {
                    // Create wrapper for the kanji word with popup
                    const wrapper = document.createElement('span');
                    wrapper.className = 'kanji-word';
                    
                    // Create popup with meaning
                    const popup = document.createElement('span');
                    popup.className = 'kanji-popup';
                    
                    // Format the popup content
                    if (matchingKanjiWord.data) {
                        const content = [];
                        if (matchingKanjiWord.data.hiragana) {
                            content.push(matchingKanjiWord.data.hiragana);
                        }
                        if (matchingKanjiWord.data.meaning) {
                            content.push(matchingKanjiWord.data.meaning);
                        }
                        popup.textContent = content.join(' - ');
                    } else {
                        popup.textContent = 'No meaning available';
                    }
                    
                    // Clone the ruby element
                    const rubyClone = node.cloneNode(true);
                    
                    // Add the popup and ruby to the wrapper
                    wrapper.appendChild(popup);
                    wrapper.appendChild(rubyClone);
                    
                    // Add the wrapper to the fragment
                    fragment.appendChild(wrapper);
                } else {
                    // If no match, just clone the ruby
                    const clone = node.cloneNode(true);
                    fragment.appendChild(clone);
                }
                
                return;
            }
            
            // For other element nodes, create a new element of the same type
            const newNode = document.createElement(node.nodeName);
            
            // Copy all attributes
            Array.from(node.attributes).forEach(attr => {
                newNode.setAttribute(attr.name, attr.value);
            });
            
            // Create a fragment for this node's children
            const childFragment = document.createDocumentFragment();
            
            // Process each child node
            Array.from(node.childNodes).forEach(child => {
                this.processNode(child, childFragment, kanjiWords);
            });
            
            // Append processed children
            newNode.appendChild(childFragment);
            
            // Add to parent fragment
            fragment.appendChild(newNode);
            
            return;
        }
        
        // Handle text nodes - this is where we check for kanji words
        const text = node.textContent;
        if (!text || text.trim() === '') {
            fragment.appendChild(document.createTextNode(text));
            return;
        }
        
        // Get kanji words that appear in this text node
        const relevantWords = kanjiWords.filter(kw => 
            text.includes(kw.word)
        ).sort((a, b) => {
            // First sort by position within the text node
            const posA = text.indexOf(a.word);
            const posB = text.indexOf(b.word);
            if (posA !== posB) return posA - posB;
            
            // If positions are the same, prefer longer words
            return b.word.length - a.word.length;
        });
        
        if (relevantWords.length === 0) {
            // No kanji words in this text, just add it as is
            fragment.appendChild(document.createTextNode(text));
            return;
        }
        
        // Process text with kanji words
        let lastIndex = 0;
        let processedIndexes = new Set(); // Track already processed parts of the text
        
        for (const word of relevantWords) {
            // Find position of this word in the text
            let position = text.indexOf(word.word, lastIndex);
            
            // If not found from lastIndex, or if this region is already processed, skip
            if (position === -1 || this.isRangeProcessed(position, position + word.word.length, processedIndexes)) {
                continue;
            }
            
            // Add text before match
            if (position > lastIndex) {
                fragment.appendChild(
                    document.createTextNode(text.substring(lastIndex, position))
                );
            }
            
            // Create span for the kanji word with popup
            const wordSpan = document.createElement('span');
            wordSpan.className = 'kanji-word';
            wordSpan.textContent = word.word;
            
            // Create popup with meaning
            const popup = document.createElement('span');
            popup.className = 'kanji-popup';
            
            // Format the popup content
            if (word.data) {
                const content = [];
                if (word.data.hiragana) {
                    content.push(word.data.hiragana);
                }
                if (word.data.meaning) {
                    content.push(word.data.meaning);
                }
                popup.textContent = content.join(' - ');
            } else {
                popup.textContent = 'No meaning available';
            }
            
            wordSpan.appendChild(popup);
            fragment.appendChild(wordSpan);
            
            // Mark this range as processed
            this.markRangeProcessed(position, position + word.word.length, processedIndexes);
            
            lastIndex = position + word.word.length;
        }
        
        // Add remaining text
        if (lastIndex < text.length) {
            fragment.appendChild(
                document.createTextNode(text.substring(lastIndex))
            );
        }
    }
    
    /**
     * Check if a range of text has already been processed
     * @param {number} start - Start index
     * @param {number} end - End index
     * @param {Set} processedIndexes - Set of already processed indexes
     * @returns {boolean} - True if any part of the range has been processed
     */
    isRangeProcessed(start, end, processedIndexes) {
        for (let i = start; i < end; i++) {
            if (processedIndexes.has(i)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Mark a range of text as processed
     * @param {number} start - Start index
     * @param {number} end - End index
     * @param {Set} processedIndexes - Set of already processed indexes
     */
    markRangeProcessed(start, end, processedIndexes) {
        for (let i = start; i < end; i++) {
            processedIndexes.add(i);
        }
    }
    
    /**
     * Get the base text (kanji part) from a ruby element
     * @param {Element} rubyElement - The ruby element
     * @returns {string} - The base text without rt or rp content
     */
    getRubyBase(rubyElement) {
        let baseText = '';
        
        Array.from(rubyElement.childNodes).forEach(child => {
            // Skip rt and rp elements
            if (child.nodeName.toLowerCase() === 'rt' || child.nodeName.toLowerCase() === 'rp') {
                return;
            }
            
            // If it's a text node, add its content
            if (child.nodeType === Node.TEXT_NODE) {
                baseText += child.textContent;
            }
            // For other element nodes, check if they're not rt or rp
            else if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.nodeName.toLowerCase() !== 'rt' && child.nodeName.toLowerCase() !== 'rp') {
                    baseText += child.textContent;
                }
            }
        });
        
        // Clean the text - remove parentheses and whitespace
        baseText = baseText.replace(/[()]/g, '').trim();
        
        return baseText;
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
        console.log(`Looking up whole word: "${word}"`);
        
        try {
            // Try inflected search first
            console.log(`Using /search/inflected for "${word}"`);
            const inflectedUrl = `http://localhost:3000/search/inflected?q=${encodeURIComponent(word)}`;
            const response = await fetch(inflectedUrl);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`/search/inflected response for "${word}":`, data);
                
                if (data.matches && data.matches.length > 0) {
                    // Find exact match first
                    const exactMatch = data.matches.find(m => m.word === word);
                    if (exactMatch && exactMatch.meaning) {
                        wordObj.data.meaning = exactMatch.meaning;
                        console.log(`Found exact meaning for "${word}": ${exactMatch.meaning}`);
                        return;
                    }
                    
                    // Use first match as fallback
                    if (data.matches[0].meaning) {
                        wordObj.data.meaning = data.matches[0].meaning;
                        console.log(`Using first match meaning for "${word}": ${data.matches[0].meaning}`);
                        return;
                    }
                }
            }
            
            // If inflected search failed, try direct search
            console.log(`Trying direct search for "${word}"`);
            const directUrl = `http://localhost:3000/search?q=${encodeURIComponent(word)}`;
            const directResponse = await fetch(directUrl);
            
            if (directResponse.ok) {
                const directData = await directResponse.json();
                if (directData.matches && directData.matches.length > 0 && directData.matches[0].meaning) {
                    wordObj.data.meaning = directData.matches[0].meaning;
                    console.log(`Found direct meaning for "${word}": ${directData.matches[0].meaning}`);
                    return;
                }
            }
            
            // If both inflected and direct search failed, try partial search
            console.log(`Trying partial search for "${word}"`);
            const partialUrl = `http://localhost:3000/search/partial?q=${encodeURIComponent(word)}&limit=5`;
            const partialResponse = await fetch(partialUrl);
            
            if (partialResponse.ok) {
                const partialData = await partialResponse.json();
                console.log(`/search/partial response for "${word}":`, partialData);
                
                if (partialData.matches && partialData.matches.length > 0 && partialData.matches[0].meaning) {
                    wordObj.data.meaning = partialData.matches[0].meaning;
                    console.log(`Found partial match meaning for "${word}": ${partialData.matches[0].meaning}`);
                    return;
                }
            }
            
            // If all else fails, set a default meaning
            if (!wordObj.data.meaning) {
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