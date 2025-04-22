// This is a test script to verify Kuroshiro is working correctly
// Run with: node test-kuroshiro.js

// Use the exact same versions as in the web app
// Note: Make sure you have run npm install before running this script
const Kuroshiro = require("kuroshiro");
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");


async function testKuroshiro() {
  try {
    console.log("Initializing Kuroshiro...");
    console.log("Kuroshiro version:", require("kuroshiro/package.json").version);
    console.log("Kuromoji Analyzer version:", require("kuroshiro-analyzer-kuromoji/package.json").version);
    
    const kuroshiro = new Kuroshiro();
    const analyzer = new KuromojiAnalyzer();
    await kuroshiro.init(analyzer);
    
    const text = "その後にふきくりがちゃんと片栗粉がある程度焦げ目がついた方が今回の美味しいと思うので";
    console.log("Original text:", text);
    
    // Test hasKanji
    console.log("Has kanji:", Kuroshiro.Util.hasKanji(text));
    
    // Test conversion
    const result = await kuroshiro.convert(text, {mode:"furigana", to:"hiragana"});
    console.log("Converted text:", result);
    
    // Analyze the text using the initialized analyzer
    const tokens = await analyzer.parse(text);
    console.log("Tokenization result:", tokens);

    console.log("Kuroshiro test successful!");
  } catch (error) {
    console.error("Error testing Kuroshiro:", error);
  }
}

testKuroshiro(); 