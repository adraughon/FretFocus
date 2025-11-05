/**
 * Chord utility functions for calculating chord tones
 */

import { NOTE_NAMES } from './scales';
import { getScaleNotes } from './scales';
import { getScalePositions } from './fretCalculator';

/**
 * Chord interval patterns (in semitones from root)
 */
export const CHORD_PATTERNS = {
  'Major': [0, 4, 7],           // 1, 3, 5
  'maj7': [0, 4, 7, 11],        // 1, 3, 5, 7
  '7': [0, 4, 7, 10],           // 1, 3, 5, b7
  'minor': [0, 3, 7],           // 1, b3, 5
  'm7': [0, 3, 7, 10],          // 1, b3, 5, b7
  'diminished': [0, 3, 6],      // 1, b3, b5
  'half-diminished': [0, 3, 6, 10], // 1, b3, b5, b7 (ø7)
  'diminished7': [0, 3, 6, 9],  // 1, b3, b5, bb7
  'sus2': [0, 2, 7],            // 1, 2, 5
  'sus4': [0, 5, 7],            // 1, 4, 5
};

/**
 * Get the notes in a chord
 * @param {string} root - Root note (e.g., 'C', 'D#')
 * @param {string} voicing - Chord voicing (e.g., 'Major', 'm7', '7')
 * @param {boolean} flattenFifth - Whether to flatten the 5th by 1 semitone
 * @param {string} key - Optional key context for diatonic sus4 (e.g., 'C', 'D#')
 * @returns {Array<string>} - Array of note names in the chord
 */
export function getChordNotes(root, voicing, flattenFifth = false, key = null) {
  const rootIndex = NOTE_NAMES.indexOf(root);
  if (rootIndex === -1) {
    throw new Error(`Invalid root note: ${root}`);
  }

  const pattern = CHORD_PATTERNS[voicing];
  if (!pattern) {
    throw new Error(`Invalid voicing: ${voicing}`);
  }

  // For sus4, use diatonic 4th from the key if provided
  if (voicing === 'sus4' && key) {
    const scaleNotes = getScaleNotes(key, 'major');
    const rootScaleIndex = scaleNotes.indexOf(root);
    
    if (rootScaleIndex !== -1) {
      // Get the 4th scale degree from the root in this key's scale
      // The 4th degree is 3 steps up in the scale (root is 0, 4th is at index 3)
      const fourthScaleIndex = (rootScaleIndex + 3) % scaleNotes.length;
      const diatonicFourth = scaleNotes[fourthScaleIndex];
      
      // Build the sus4 chord with the diatonic 4th
      const notes = [root];
      const fifthIndex = NOTE_NAMES.indexOf(root);
      const fifthNote = NOTE_NAMES[(fifthIndex + 7) % 12];
      notes.push(diatonicFourth);
      notes.push(fifthNote);
      
      // If flattening fifth, adjust the 5th
      if (flattenFifth) {
        const flattenedFifthIndex = NOTE_NAMES.indexOf(fifthNote);
        const flattenedFifthNote = NOTE_NAMES[(flattenedFifthIndex - 1 + 12) % 12];
        notes[2] = flattenedFifthNote;
      }
      
      return notes;
    }
  }

  // Generate notes by applying intervals to the root
  const notes = pattern.map(interval => {
    // If flattening fifth, adjust the 5th interval (7 semitones) to 6 semitones
    let adjustedInterval = interval;
    if (flattenFifth && interval === 7) {
      adjustedInterval = 6;
    }
    const noteIndex = (rootIndex + adjustedInterval) % 12;
    return NOTE_NAMES[noteIndex];
  });

  return notes;
}

/**
 * Get the 7 chords from a major key as seventh chords (jazz style)
 * @param {string} key - The key (e.g., 'C', 'D#')
 * @returns {Array<Object>} - Array of {degree, note, voicing, label} objects
 */
export function getSeventhChordsFromKey(key) {
  const scaleNotes = getScaleNotes(key, 'major');
  
  // Seventh chords in a major key: I7, ii7, iii7, IV7, V7, vi7, viiø7
  const voicings = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'half-diminished'];
  const degrees = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'];
  
  return scaleNotes.map((note, index) => ({
    degree: degrees[index],
    note: note,
    voicing: voicings[index],
    label: `${note}${voicings[index] === 'half-diminished' ? 'ø7' : voicings[index] === 'maj7' ? 'maj7' : voicings[index]}`
  }));
}

/**
 * Get all fret positions that match notes in a chord
 * @param {string} root - Root note
 * @param {string} voicing - Chord voicing
 * @param {boolean} flattenFifth - Whether to flatten the 5th
 * @param {number} maxFrets - Maximum number of frets to check
 * @returns {Array<Object>} - Array of {stringIndex, fret, note} objects
 */
export function getChordPositions(root, voicing, flattenFifth = false, maxFrets = 16) {
  const chordNotes = getChordNotes(root, voicing, flattenFifth);
  return getScalePositions(chordNotes, maxFrets);
}

/**
 * Get the function of a note within a chord (e.g., 1, 3, 5, 7, b3, b5, b7)
 * @param {string} note - The note to check
 * @param {string} chordRoot - Root note of the chord
 * @param {string} voicing - Chord voicing
 * @returns {string} - Function label (e.g., '1', '3', '5', '7', 'b3', 'b5', 'b7')
 */
export function getChordFunction(note, chordRoot, voicing) {
  const rootIndex = NOTE_NAMES.indexOf(chordRoot);
  const noteIndex = NOTE_NAMES.indexOf(note);
  
  if (rootIndex === -1 || noteIndex === -1) {
    return null;
  }
  
  // Calculate semitone distance from root
  let semitones = (noteIndex - rootIndex + 12) % 12;
  
  // Get the pattern for this voicing
  const pattern = CHORD_PATTERNS[voicing];
  if (!pattern) {
    return null;
  }
  
  // Find which interval in the pattern matches this semitone distance
  const intervalIndex = pattern.indexOf(semitones);
  if (intervalIndex === -1) {
    return null;
  }
  
  // Map interval indices to function names
  const functionNames = {
    0: '1',      // Root
    1: '3',      // Third
    2: '5',      // Fifth
    3: '7',      // Seventh
  };
  
  // Map semitones to function names with accidentals
  const semitoneToFunction = {
    0: '1',
    1: 'b2',
    2: '2',
    3: 'b3',
    4: '3',
    5: '4',
    6: 'b5',
    7: '5',
    8: '#5',
    9: '6',
    10: 'b7',
    11: '7',
  };
  
  // Special handling for sus2 and sus4 chords
  if (voicing === 'sus2') {
    if (semitones === 0) return '1';
    if (semitones === 2) return '2';
    if (semitones === 7) return '5';
  }
  if (voicing === 'sus4') {
    if (semitones === 0) return '1';
    if (semitones === 5) return '4';
    if (semitones === 7) return '5';
  }
  
  // Check if this is a standard chord tone
  if (intervalIndex < functionNames.length) {
    // For standard chord tones, check if we need accidentals
    const expectedSemitones = pattern[intervalIndex];
    if (semitones === expectedSemitones) {
      return semitoneToFunction[semitones];
    }
  }
  
  // Fallback: use semitone to function mapping
  return semitoneToFunction[semitones] || null;
}

/**
 * Get the function of a note within a key (e.g., 1, 2, 3, 4, 5, 6, 7)
 * @param {string} note - The note to check
 * @param {string} key - The key
 * @returns {string} - Function label (e.g., '1', '2', '3', '4', '5', '6', '7')
 */
export function getKeyFunction(note, key) {
  const scaleNotes = getScaleNotes(key, 'major');
  const scaleIndex = scaleNotes.indexOf(note);
  
  if (scaleIndex === -1) {
    return null;
  }
  
  // Map scale index to function (1-indexed)
  const functionNames = ['1', '2', '3', '4', '5', '6', '7'];
  return functionNames[scaleIndex] || null;
}

