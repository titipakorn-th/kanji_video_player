# Kanji Video Player

A video player that supports MP4 and MKV formats with SRT subtitle processing. The player automatically converts Japanese kanji in subtitles to furigana/hiragana using Kuroshiro.

## Features

- Supports MP4 and MKV video formats
- SRT subtitle support
- Automatic kanji to furigana conversion
- Simple, clean interface

## Usage

1. Open `index.html` in your browser
2. Use the "Select Video" button to choose an MP4 or MKV file
3. Use the "Select Subtitles" button to choose an SRT subtitle file
4. Play the video using the controls

## Installation Options

### Option 1: Quick Start with npm

For reliable operation with a local server:

```bash
# Install dependencies
npm install

# Start a local server
npm start
```

Then open http://localhost:3000 in your browser.

### Option 2: Local Files (Most Reliable)

If you experience issues with CDN-loaded libraries:

```bash
# Download local copies of libraries and create local.html
bash local-setup.sh

# Start a local server
npm start
```

Then open http://localhost:3000/local.html in your browser.

## Troubleshooting

### Kuroshiro Loading Issues

If you see errors like "Kuroshiro is not a constructor" or "Failed to load resource":

1. Try using the local installation method (Option 2 above)
2. Make sure you're running the app from a web server, not local files
3. Check if your browser is blocking scripts from CDN domains
4. Verify the libraries work in your environment with:
   ```
   node test-kuroshiro.js
   ```

### Browser Compatibility

Some browsers may have limited support for MKV files. For best results:
- Use Chrome or Firefox
- Convert MKV to MP4 if you experience playback issues

## Technical Details

- Uses HTML5 video player
- Kuroshiro with Kuromoji analyzer for kanji processing
- Pure JavaScript implementation
- SRT subtitle parsing and display

## Requirements

- Modern browser with JavaScript enabled
- Web server (included when using npm start)
- Internet connection (for loading Kuroshiro libraries) or local copies

## How It Works

When a subtitle contains kanji (detected using `Kuroshiro.Util.hasKanji()`), the text is automatically processed using Kuroshiro to convert it to furigana format before being displayed. This makes it easier to read and understand Japanese text in the subtitles.

## Known Limitations

- Large MKV files may have performance issues in some browsers
- Initial Kuroshiro dictionary loading may take a few seconds
- Some browsers have limited MKV support 