# Guitar Tab Scraping and Parsing Scripts

This directory contains scripts to fetch guitar tabs from Ultimate Guitar and parse them into structured data.

## Setup

Install dependencies:
```bash
npm install
```

## Scripts

### `fetchTab.js`
Fetches a guitar tab from Ultimate Guitar and extracts the monospaced text representation.

**Usage:**
```bash
node scripts/fetchTab.js <tab_url>
```

**Example:**
```bash
node scripts/fetchTab.js https://www.ultimate-guitar.com/tab/artist/song-id
```

**Output:** Prints the cleaned monospaced tab text (6 lines, one per string).

### `parseTab.js`
Parses a monospaced guitar tab text file and extracts stepwise information.

**Usage:**
```bash
node scripts/parseTab.js <tab_file_path>
```

**Example:**
```bash
node scripts/parseTab.js tab.txt
```

**Output:** Prints stepwise parsed data showing each column position with notes (fret, string, note name).

### `tabPipeline.js`
Complete pipeline: fetches a tab from Ultimate Guitar, parses it, and extracts stepwise data.

**Usage:**
```bash
node scripts/tabPipeline.js <tab_url>
```

**Example:**
```bash
node scripts/tabPipeline.js https://www.ultimate-guitar.com/tab/artist/song-id
```

**Output:** Prints both the cleaned tab text and the parsed stepwise data.

## API Usage

You can also import and use these functions in your own code:

```javascript
import { fetchTabText, cleanTabText } from './scripts/fetchTab.js';
import { parseTab, formatParsedTab, fretToNote } from './scripts/parseTab.js';
import { fetchAndParseTab } from './scripts/tabPipeline.js';

// Fetch and parse a tab
const result = await fetchAndParseTab('https://www.ultimate-guitar.com/tab/...');
console.log(result.steps); // Array of step objects
```

## Data Structure

### Step Object
Each step represents a column position in the tab:
```javascript
{
  column: 10,        // Column position (0-indexed)
  notes: [
    {
      string: 0,      // String index (0 = high E, 5 = low E)
      stringName: 'E', // String name
      fret: 5,        // Fret number
      column: 10,     // Column where this note starts
      width: 1        // Number of columns this note spans
    }
  ]
}
```

## Notes

- Tabs are assumed to be 6 strings (standard guitar tuning: E, B, G, D, A, E)
- The parser handles single-digit (0-9) and multi-digit (10-24) fret numbers
- Columns with multiple notes at the same position represent chords
- The parser steps through the tab left-to-right, extracting each note position

## Troubleshooting

If fetching fails:
- Check that the Ultimate Guitar URL is valid
- Ultimate Guitar may block automated requests - you may need to adjust headers or use a different approach
- Some tabs may be behind a paywall or require login

If parsing fails:
- Ensure the tab text has exactly 6 lines (one per string)
- Check that the tab uses standard monospaced formatting
- Verify the tab contains valid fret numbers (0-24)

