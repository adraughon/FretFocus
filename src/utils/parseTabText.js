/**
 * Parses pasted tab text and extracts the actual tab content
 * Handles cases where there's header information before the tab starts
 */

/**
 * Finds where the actual tab content starts by looking for string identifier patterns
 * @param {string} tabText - Raw pasted tab text
 * @returns {number} - Index of the first line that starts the tab, or -1 if not found
 */
function findTabStart(tabText) {
  const lines = tabText.split('\n');
  
  // Look for lines that match the pattern: string identifier (E|, B|, G|, D|, A|) followed by tab characters
  // Pattern: E|-, B|-, G|-, D|-, A|- followed by tab content (dashes, numbers, pipes)
  const tabStartPattern = /^[EBGDA]\|[-\d|]|^[ebgda]\|[-\d|]/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (tabStartPattern.test(line)) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Groups tab lines into metarows (chunks of 6 lines, one per string)
 * @param {Array<string>} tabLines - Array of tab lines starting with E|, B|, etc.
 * @returns {Array<Object>} - Array of metarows, each containing content for each string index
 */
function groupIntoMetarows(tabLines) {
  const metarows = [];
  let currentMetarow = {};
  let lastStringIndex = -1;
  let eCount = 0; // Track which E string we're on (0 = high E, 1 = low E)

  for (const line of tabLines) {
    const trimmed = line.trim();
    if (!trimmed || !/^[EBGDAebgda]\|[-\d|]/.test(trimmed)) {
      continue;
    }

    // Extract string identifier and content
    const pipeIndex = trimmed.indexOf('|');
    if (pipeIndex === -1) continue;
    
    const identifier = trimmed.substring(0, pipeIndex).toUpperCase();
    const content = trimmed.substring(pipeIndex + 1);

    // Determine string index (0 = high E, 1 = B, 2 = G, 3 = D, 4 = A, 5 = low E)
    let stringIndex;
    if (identifier === 'E') {
      if (eCount === 0) {
        stringIndex = 0; // High E
        eCount = 1;
      } else {
        stringIndex = 5; // Low E
        eCount = 0; // Reset for next metarow
      }
    } else {
      const map = { 'B': 1, 'G': 2, 'D': 3, 'A': 4 };
      stringIndex = map[identifier];
      if (stringIndex === undefined) continue;
    }

    // If we see high E (index 0) and we already have a metarow started, save it
    if (stringIndex === 0 && Object.keys(currentMetarow).length > 0) {
      metarows.push({ ...currentMetarow });
      currentMetarow = {};
    }

    // Add this line to current metarow
    currentMetarow[stringIndex] = content;
    lastStringIndex = stringIndex;
  }

  // Add the last metarow if it exists
  if (Object.keys(currentMetarow).length > 0) {
    metarows.push(currentMetarow);
  }

  return metarows;
}

/**
 * Concatenates metarows horizontally into a single continuous 6-row ribbon
 * @param {Array<Array<string>>} metarows - Array of metarows
 * @returns {Array<string>} - 6 concatenated string lines
 */
function concatenateMetarows(metarows) {
  if (metarows.length === 0) {
    return [];
  }

  // Initialize 6 empty strings (one per string)
  const stringLines = ['', '', '', '', '', ''];

  // Concatenate each metarow horizontally
  for (const metarow of metarows) {
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
      const content = metarow[stringIndex] || '';
      stringLines[stringIndex] += content;
    }
  }

  // Format with string identifiers
  const stringNames = ['E', 'B', 'G', 'D', 'A', 'E'];
  return stringLines.map((content, index) => `${stringNames[index]}|${content}`);
}

/**
 * Extracts and cleans the tab content from pasted text
 * Groups tab lines into metarows (chunks of 6) and concatenates them horizontally
 * @param {string} tabText - Raw pasted tab text (may include headers)
 * @returns {string} - Cleaned tab text as a single continuous 6-row ribbon
 */
export function extractTabContent(tabText) {
  if (!tabText || !tabText.trim()) {
    return '';
  }

  const lines = tabText.split('\n');
  const tabStartIndex = findTabStart(tabText);
  
  // Get all tab lines (starting with E|, B|, etc.)
  let tabLines;
  if (tabStartIndex === -1) {
    // If we can't find a clear start, filter all lines
    tabLines = lines
      .map(line => line.trim())
      .filter(trimmed => trimmed.length > 0 && /^[EBGDAebgda]\|[-\d|]/.test(trimmed));
  } else {
    // Extract from tab start onwards
    tabLines = lines.slice(tabStartIndex)
      .map(line => line.trim())
      .filter(trimmed => trimmed.length > 0 && /^[EBGDAebgda]\|[-\d|]/.test(trimmed));
  }
  
  if (tabLines.length === 0) {
    return '';
  }

  // Group into metarows (chunks of 6 lines)
  const metarows = groupIntoMetarows(tabLines);
  
  // Concatenate metarows horizontally
  const concatenatedLines = concatenateMetarows(metarows);

  return concatenatedLines.join('\n');
}

/**
 * Validates that the extracted tab text looks like a valid guitar tab
 * @param {string} tabText - Tab text to validate
 * @returns {boolean} - True if it looks like valid tab content
 */
export function isValidTabText(tabText) {
  if (!tabText || !tabText.trim()) {
    return false;
  }

  const lines = tabText.split('\n').filter(line => line.trim().length > 0);
  
  // Should have at least 3 lines (minimum for a tab)
  if (lines.length < 3) {
    return false;
  }

  // All lines should start with string identifiers (E|, B|, G|, D|, A|)
  const allHaveStringIdentifiers = lines.every(line => /^[EBGDAebgda]\|[-\d|]/.test(line.trim()));
  
  // Should have at least some tab-like characters (dashes, numbers)
  const hasTabCharacters = lines.some(line => /[-|0-9]/.test(line.trim()));

  return allHaveStringIdentifiers && hasTabCharacters && lines.length >= 3;
}

/**
 * Finds all unique character positions in tab text
 * A position is "unique" if at least one string has a non-dash, non-space, non-pipe character at that column
 * @param {string} tabText - Tab text with lines starting with E|, B|, etc.
 * @returns {Array<number>} - Array of column positions (0-indexed) that contain unique characters
 */
export function findUniqueCharacterPositions(tabText) {
  if (!tabText || !tabText.trim()) {
    return [];
  }

  const lines = tabText.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return [];
  }

  // Extract content after the pipe (E|, B|, etc.)
  const contentLines = lines
    .filter(line => /^[EBGDAebgda]\|/.test(line.trim()))
    .map(line => {
      const pipeIndex = line.indexOf('|');
      return pipeIndex !== -1 ? line.substring(pipeIndex + 1) : '';
    });

  if (contentLines.length === 0) {
    return [];
  }

  // Find the maximum length across all lines
  const maxLength = Math.max(...contentLines.map(line => line.length));

  // Characters that are considered "unique" - only numbers (0-9)
  // Ignore letters (b, h, p, s, etc.) and special characters used for techniques
  const isUniqueChar = (char) => {
    if (!char) return false;
    // Only consider numeric characters (0-9) as unique
    return /[0-9]/.test(char);
  };

  const uniquePositions = [];
  const processedColumns = new Set(); // Track columns that are part of multi-digit numbers

  // Check each column position
  for (let col = 0; col < maxLength; col++) {
    // Skip if this column is part of a multi-digit number we've already processed
    if (processedColumns.has(col)) {
      continue;
    }

    // Check if any string has a unique character at this column
    let hasUniqueChar = false;
    let maxDigitWidth = 1; // Track the maximum width of a digit sequence at this column
    
    for (const line of contentLines) {
      if (col < line.length && isUniqueChar(line[col])) {
        hasUniqueChar = true;
        
        // Check how many consecutive digits follow this one (for multi-digit frets like 10, 12, 15)
        let digitWidth = 1;
        let offset = 1;
        while (col + offset < line.length && /\d/.test(line[col + offset])) {
          digitWidth++;
          offset++;
        }
        
        // Track the maximum width across all strings at this column
        if (digitWidth > maxDigitWidth) {
          maxDigitWidth = digitWidth;
        }
      }
    }

    if (hasUniqueChar) {
      uniquePositions.push({
        column: col,
        width: maxDigitWidth // Store the width of this number
      });
      
      // Mark subsequent columns as processed if this is a multi-digit number
      for (let i = 1; i < maxDigitWidth; i++) {
        processedColumns.add(col + i);
      }
    }
  }

  return uniquePositions;
}

/**
 * Parses notes from a specific column position in tab text
 * @param {string} tabText - Tab text with lines starting with E|, B|, etc.
 * @param {number} column - Column position (0-indexed, after the pipe)
 * @returns {Array<Object>} - Array of {stringIndex, fret, note} objects
 */
export function parseNotesAtColumn(tabText, column) {
  if (!tabText || !tabText.trim()) {
    return [];
  }

  const lines = tabText.split('\n').filter(line => line.trim().length > 0);
  
  // Extract content after the pipe (E|, B|, etc.)
  const contentLines = lines
    .filter(line => /^[EBGDAebgda]\|/.test(line.trim()))
    .map(line => {
      const pipeIndex = line.indexOf('|');
      return pipeIndex !== -1 ? line.substring(pipeIndex + 1) : '';
    });

  if (contentLines.length === 0 || column < 0) {
    return [];
  }

  const notes = [];
  const stringNames = ['E', 'B', 'G', 'D', 'A', 'E']; // High E to low E

  // Check each string at this column position
  for (let stringIndex = 0; stringIndex < contentLines.length && stringIndex < 6; stringIndex++) {
    const line = contentLines[stringIndex];
    
    if (column >= line.length) {
      continue;
    }

    const char = line[column];
    
    // Check if this character is a digit (start of a fret number)
    if (/\d/.test(char)) {
      // Collect all consecutive digits (could be single like 5 or multi-digit like 15)
      let fretNumber = '';
      let offset = 0;
      
      while (column + offset < line.length && /\d/.test(line[column + offset])) {
        fretNumber += line[column + offset];
        offset++;
      }
      
      if (fretNumber) {
        const fret = parseInt(fretNumber, 10);
        notes.push({
          stringIndex,
          fret,
          note: null // Will be calculated by the caller if needed
        });
      }
    }
  }

  return notes;
}

