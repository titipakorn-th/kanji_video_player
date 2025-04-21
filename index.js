import Kuroshiro from "kuroshiro";
// Initialize kuroshiro with an instance of analyzer (You could check the [apidoc](#initanalyzer) for more information):
// For this example, you should npm install and import the kuromoji analyzer first
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

// Use an immediately invoked function expression for async operations
(async function() {
  try {
    // Instantiate
    const kuroshiro = new Kuroshiro();
    
    console.log("Initializing Kuroshiro...");
    // Initialize
    await kuroshiro.init(new KuromojiAnalyzer());
    
    // Convert what you want:
    const result = await kuroshiro.convert("感じ取れたら手を繋ごう、重なるのは人生のライン and レミリア最高！", {mode:"furigana", to:"hiragana"});
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  }
})();