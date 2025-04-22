/**
 * Kanji dictionary for looking up meanings using the external API
 */
class KanjiDictionary {
    constructor() {
        this.apiBaseUrl = "http://localhost:3000";
        this.cache = new Map(); // Simple cache to avoid repeated API calls
        // Get Kuroshiro class if available
        this.KuroshiroClass = typeof Kuroshiro !== 'undefined' ? Kuroshiro : window.Kuroshiro;
    }

    /**
     * Look up the meaning of a word using the API
     * @param {string} word - The word to look up
     * @returns {Promise<object|null>} - The word data including meaning and reading, or null if not found
     */
    async getWordMeaning(word) {
        // Check cache first
        if (this.cache.has(word)) {
            return this.cache.get(word);
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/search?q=${encodeURIComponent(word)}`);
            
            if (!response.ok) {
                console.error(`API error: ${response.status} ${response.statusText}`);
                return null;
            }
            
            const data = await response.json();
            
            if (data.matches && data.matches.length > 0) {
                // Cache the result
                this.cache.set(word, data.matches[0]);
                return data.matches[0];
            }
            
            // No matches found
            this.cache.set(word, null);
            return null;
        } catch (error) {
            console.error("Error fetching word meaning:", error);
            return null;
        }
    }

    /**
     * Find kanji words in a text string using the direct search API
     * @param {string} text - The text to analyze
     * @param {Array} expectedWords - Array of expected words from ruby elements to search
     * @returns {Promise<Array>} - Array of objects with word and its meaning
     */
    async findKanjiWords(text, expectedWords = []) {
        if (!text || text.trim() === '') {
            return [];
        }

        try {
            // First try to detect kanji characters using Kuroshiro if available
            const util = this.KuroshiroClass?.Util;
            const hasKanji = util && util.hasKanji ? util.hasKanji(text) : /[\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
            
            if (!hasKanji) {
                console.log("No kanji found in text, skipping search");
                return []; // No kanji, no need to search
            }
            
            const results = [];
            
            // Process each expected word from ruby elements
            if (expectedWords && expectedWords.length > 0) {
                console.log(`Looking up ${expectedWords.length} expected words from ruby elements:`, expectedWords);
                let processedCount = 0;
                
                for (const word of expectedWords) {
                    processedCount++;
                    console.log(`Processing word ${processedCount}/${expectedWords.length}: '${word}'`);
                    
                    // Skip if not containing kanji
                    const wordHasKanji = util && util.hasKanji ? 
                        util.hasKanji(word) : 
                        /[\u4e00-\u9faf\u3400-\u4dbf]/.test(word);
                    
                    if (!wordHasKanji) {
                        console.log(`Word '${word}' has no kanji, skipping`);
                        continue;
                    }
                    
                    // Use direct search for this word
                    console.log(`Using direct /search for word: '${word}'`);
                    const wordUrl = `${this.apiBaseUrl}/search?q=${encodeURIComponent(word)}`;
                    
                    try {
                        const response = await fetch(wordUrl);
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`Search for '${word}' results:`, data);
                            
                            if (data.matches && data.matches.length > 0) {
                                // Find exact match first
                                const exactMatch = data.matches.find(m => m.word === word);
                                let matchToUse;
                                
                                if (exactMatch) {
                                    console.log(`Found exact match for '${word}'`, exactMatch);
                                    matchToUse = exactMatch;
                                } else {
                                    // Use first match as fallback
                                    console.log(`Using first match for '${word}'`, data.matches[0]);
                                    matchToUse = data.matches[0];
                                }
                                
                                // Find position in text
                                let position = text.indexOf(word);
                                if (position === -1) {
                                    console.log(`Word '${word}' not found in original text, using default position`);
                                    position = 0;
                                }
                                
                                // Add to results
                                results.push({
                                    word: word,
                                    position: position,
                                    length: word.length,
                                    data: matchToUse
                                });
                                
                                console.log(`Added '${word}' to results at position ${position}`);
                            } else {
                                console.log(`No matches found for '${word}', trying individual kanji`);
                                
                                // Try to look up individual kanji in this word
                                await this.lookupIndividualKanji(word, text, results);
                            }
                        } else {
                            console.log(`Error looking up '${word}': ${response.status}`);
                            
                            // Try to look up individual kanji
                            await this.lookupIndividualKanji(word, text, results);
                        }
                    } catch (error) {
                        console.error(`Error looking up '${word}':`, error);
                        
                        // Try to look up individual kanji
                        await this.lookupIndividualKanji(word, text, results);
                    }
                }
                
                console.log(`Finished processing all ${expectedWords.length} words, found ${results.length} results`);
            }
            
            // Look for additional standalone kanji characters in the text
            if (results.length === 0) {
                console.log("No words found from ruby elements, scanning for standalone kanji");
                // Extract all kanji characters from the text
                const kanjiChars = [];
                for (let i = 0; i < text.length; i++) {
                    const char = text.charAt(i);
                    const isKanji = util && util.hasKanji ? 
                        util.hasKanji(char) : 
                        /[\u4e00-\u9faf\u3400-\u4dbf]/.test(char);
                    
                    if (isKanji && !kanjiChars.includes(char)) {
                        kanjiChars.push(char);
                    }
                }
                
                console.log("Individual kanji found in text:", kanjiChars);
                
                // Look up each individual kanji
                for (const kanji of kanjiChars) {
                    console.log(`Looking up individual kanji: '${kanji}'`);
                    const kanjiUrl = `${this.apiBaseUrl}/search?q=${encodeURIComponent(kanji)}`;
                    
                    try {
                        const response = await fetch(kanjiUrl);
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            if (data.matches && data.matches.length > 0) {
                                const match = data.matches.find(m => m.word === kanji) || data.matches[0];
                                
                                // Find position in text
                                const position = text.indexOf(kanji);
                                
                                // Add to results
                                results.push({
                                    word: kanji,
                                    position: position,
                                    length: kanji.length,
                                    data: match
                                });
                                
                                console.log(`Added individual kanji '${kanji}' to results`);
                            }
                        }
                    } catch (error) {
                        console.error(`Error looking up kanji '${kanji}':`, error);
                    }
                }
            }
            
            // Sort by position so we process text in order
            results.sort((a, b) => a.position - b.position);
            console.log(`Final results (${results.length} words):`, results.map(r => r.word));
            return results;
        } catch (error) {
            console.error("Error finding kanji words:", error);
            return [];
        }
    }

    /**
     * Helper method to look up individual kanji in a word
     * @param {string} word - The word containing kanji
     * @param {string} text - The original text
     * @param {Array} results - Results array to add findings to
     */
    async lookupIndividualKanji(word, text, results) {
        // Extract kanji from word
        const kanjiChars = [];
        for (let i = 0; i < word.length; i++) {
            const char = word.charAt(i);
            // Basic check for kanji
            if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(char)) {
                kanjiChars.push(char);
            }
        }
        
        if (kanjiChars.length === 0) {
            console.log(`No kanji found in word '${word}'`);
            return;
        }
        
        console.log(`Looking up ${kanjiChars.length} individual kanji in word '${word}'`);
        
        // Arrays to collect meanings and readings
        const kanjiMeanings = [];
        const kanjiReadings = [];
        
        // Look up each kanji individually
        for (const kanji of kanjiChars) {
            console.log(`Looking up kanji: '${kanji}'`);
            let found = false;
            
            // First try direct search
            const url = `${this.apiBaseUrl}/search?q=${encodeURIComponent(kanji)}`;
            
            try {
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.matches && data.matches.length > 0) {
                        const match = data.matches.find(m => m.word === kanji) || data.matches[0];
                        
                        if (match.meaning) {
                            found = true;
                            kanjiMeanings.push(`${kanji}: ${match.meaning}`);
                            console.log(`Found meaning for kanji '${kanji}': ${match.meaning}`);
                            
                            if (match.hiragana) {
                                kanjiReadings.push(`${kanji}: ${match.hiragana}`);
                            }
                        }
                    } else {
                        console.log(`No matches found for kanji '${kanji}' with direct search`);
                    }
                }
            } catch (error) {
                console.error(`Error looking up kanji '${kanji}':`, error);
            }
            
            // If direct search failed, try partial search
            if (!found) {
                console.log(`Trying partial search for kanji: '${kanji}'`);
                const partialUrl = `${this.apiBaseUrl}/search/partial?q=${encodeURIComponent(kanji)}&limit=5`;
                
                try {
                    const partialResponse = await fetch(partialUrl);
                    
                    if (partialResponse.ok) {
                        const partialData = await partialResponse.json();
                        console.log(`/search/partial response for kanji '${kanji}':`, partialData);
                        
                        if (partialData.matches && partialData.matches.length > 0) {
                            // Try to find an exact match first
                            const exactMatch = partialData.matches.find(m => m.word === kanji);
                            const match = exactMatch || partialData.matches[0];
                            
                            if (match.meaning) {
                                kanjiMeanings.push(`${kanji}: ${match.meaning}`);
                                console.log(`Found partial meaning for kanji '${kanji}': ${match.meaning}`);
                                
                                if (match.hiragana) {
                                    kanjiReadings.push(`${kanji}: ${match.hiragana}`);
                                }
                            }
                        } else {
                            console.log(`No partial matches found for kanji '${kanji}'`);
                        }
                    }
                } catch (error) {
                    console.error(`Error in partial search for kanji '${kanji}':`, error);
                }
            }
        }
        
        // Create combined data if we found any meanings
        if (kanjiMeanings.length > 0) {
            const position = text.indexOf(word);
            
            results.push({
                word: word,
                position: position,
                length: word.length,
                data: {
                    word: word,
                    hiragana: kanjiReadings.length > 0 ? kanjiReadings.join(' + ') : '',
                    meaning: kanjiMeanings.join('; ')
                }
            });
            
            console.log(`Added word '${word}' with combined kanji meanings to results`);
        }
    }
}

// Create global instance
const kanjiDictionary = new KanjiDictionary(); 