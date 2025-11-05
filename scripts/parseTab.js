import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Extracts tab lines from text that may contain headers, annotations, etc.
 * @param {string} tabText - Raw tab text with possible headers
 * @returns {Array<string>} - Array of 6 tab lines (one per string)
 */
function extractTabLines(tabText) {
  const lines = tabText.split('\n');
  
  // String identifier to index mapping
  const stringMap = {
    'B|': 1,
    'G|': 2,
    'D|': 3,
    'A|': 4
  };
  
  // Find lines that start with string identifiers
  const tabLines = [];
  let eCount = 0; // Track which E string we're on (0 = high E, 1 = low E)
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Extract content after the pipe
    const pipeIndex = trimmed.indexOf('|');
    if (pipeIndex === -1) continue;
    
    const identifier = trimmed.substring(0, pipeIndex + 1);
    const tabContent = trimmed.substring(pipeIndex + 1);
    
    // Determine string index
    let stringIndex;
    if (identifier === 'E|') {
      // First E is high E (index 0), subsequent Es are low E (index 5)
      if (eCount === 0) {
        stringIndex = 0; // High E
      } else {
        stringIndex = 5; // Low E
      }
      eCount++;
    } else if (stringMap.hasOwnProperty(identifier)) {
      stringIndex = stringMap[identifier];
    } else {
      continue; // Not a valid string identifier
    }
    
    tabLines.push({
      stringIndex: stringIndex,
      content: tabContent
    });
  }
  
  // Group by string index and combine content from all sections
  const stringContent = new Map();
  for (const tabLine of tabLines) {
    if (!stringContent.has(tabLine.stringIndex)) {
      stringContent.set(tabLine.stringIndex, []);
    }
    stringContent.get(tabLine.stringIndex).push(tabLine.content);
  }
  
  // Combine all sections for each string and extract the tab content
  const result = [];
  for (let i = 0; i < 6; i++) {
    if (stringContent.has(i)) {
      // Combine all sections for this string
      const sections = stringContent.get(i);
      // Join sections together
      result.push(sections.join(''));
    } else {
      result.push(''); // Empty string if no content found
    }
  }
  
  return result;
}

/**
 * Parses a monospaced guitar tab and extracts stepwise information
 * @param {string} tabText - The monospaced tab text (may include headers and annotations)
 * @returns {Array<Object>} - Array of step objects, each containing position and notes
 */
export function parseTab(tabText) {
  // Extract just the tab content lines
  const stringLines = extractTabLines(tabText);
  
  if (stringLines.length < 6) {
    throw new Error(`Expected 6 string lines, got ${stringLines.length}`);
  }

  // Normalize all lines to the same length (pad with spaces)
  const maxLength = Math.max(...stringLines.map(line => line.length));
  const normalizedLines = stringLines.map(line => line.padEnd(maxLength, ' '));

  // Guitar strings from high E (top) to low E (bottom)
  const stringNames = ['E', 'B', 'G', 'D', 'A', 'E'];
  
  const steps = [];
  
  // Track which columns we've already processed (for multi-digit frets)
  const processedColumns = new Set();
  
  // Step through each column position (left to right)
  for (let col = 0; col < maxLength; col++) {
    // Skip if we've already processed this column (it was part of a multi-digit fret)
    if (processedColumns.has(col)) {
      continue;
    }

    const position = {
      column: col,
      notes: []
    };

    // Check each string at this column position
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
      const char = normalizedLines[stringIndex][col];
      
      // Check if this character is a fret number (0-9) or multi-digit fret (10-24)
      if (/\d/.test(char)) {
        // Check if this is the start of a multi-digit fret number
        let fretNumber = '';
        let lookahead = 0;
        
        // Collect digits (could be single digit like 5, or multi-digit like 12)
        while (col + lookahead < maxLength && /\d/.test(normalizedLines[stringIndex][col + lookahead])) {
          fretNumber += normalizedLines[stringIndex][col + lookahead];
          lookahead++;
        }
        
        if (fretNumber) {
          const fret = parseInt(fretNumber, 10);
          const stringName = stringNames[stringIndex];
          
          position.notes.push({
            string: stringIndex,
            stringName: stringName,
            fret: fret,
            column: col,
            width: fretNumber.length // How many columns this fret number spans
          });
          
          // Mark all columns used by this multi-digit fret as processed
          for (let i = 1; i < fretNumber.length; i++) {
            processedColumns.add(col + i);
          }
        }
      }
    }

    // Only add positions that have at least one note
    if (position.notes.length > 0) {
      steps.push(position);
    }
  }

  return steps;
}

/**
 * Converts fret/string to note name
 * @param {number} fret - The fret number (0-24)
 * @param {string} stringName - The string name ('E', 'B', 'G', 'D', 'A')
 * @returns {string} - The note name (e.g., 'C', 'C#', 'D')
 */
export function fretToNote(fret, stringName) {
  const openNotes = {
    'E': 4,  // E4
    'B': 11, // B3
    'G': 7,  // G3
    'D': 2,  // D3
    'A': 9   // A2
  };

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const openNote = openNotes[stringName];
  const noteIndex = (openNote + fret) % 12;
  return noteNames[noteIndex];
}

/**
 * Formats parsed tab data for display
 * @param {Array<Object>} steps - The parsed steps from parseTab
 * @returns {string} - Formatted string representation
 */
export function formatParsedTab(steps) {
  let output = '';
  steps.forEach((step, index) => {
    output += `Step ${index + 1} (Column ${step.column}):\n`;
    step.notes.forEach(note => {
      const noteName = fretToNote(note.fret, note.stringName);
      output += `  String ${note.string} (${note.stringName}): Fret ${note.fret} (${noteName})\n`;
    });
    output += '\n';
  });
  return output;
}

// CLI usage
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  import('fs').then(fs => {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Usage: node parseTab.js <tab_file_path>');
      process.exit(1);
    }

    const filePath = args[0];
    const tabText = fs.readFileSync(filePath, 'utf-8');
    const steps = parseTab(tabText);
    console.log(formatParsedTab(steps));
    console.log(`\nTotal steps: ${steps.length}`);
  }).catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

