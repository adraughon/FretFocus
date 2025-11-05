/**
 * Utility functions for calculating note positions on the fretboard
 */

/**
 * String tunings (open string notes)
 * Note: This is a 6-string configuration (standard guitar tuning)
 * Order: High E, B, G, D, A, Low E (from top to bottom on fretboard)
 */
export const STRING_TUNINGS = [
  { name: 'E', midi: 64 },   // E4 (high E)
  { name: 'B', midi: 59 },   // B3
  { name: 'G', midi: 55 },   // G3
  { name: 'D', midi: 50 },   // D3
  { name: 'A', midi: 45 },   // A2
  { name: 'E', midi: 40 }    // E2 (low E)
];

/**
 * Note names array
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get the note name at a given fret on a given string
 * @param {number} stringIndex - Index of the string (0-5)
 * @param {number} fret - Fret number (0-16)
 * @returns {string} - Note name (e.g., 'C', 'C#', 'D')
 */
export function getNoteAtFret(stringIndex, fret) {
  const stringTuning = STRING_TUNINGS[stringIndex];
  const openNoteName = stringTuning.name;
  const openNoteIndex = NOTE_NAMES.indexOf(openNoteName);
  
  if (openNoteIndex === -1) {
    throw new Error(`Invalid string tuning: ${stringTuning.name}`);
  }

  const noteIndex = (openNoteIndex + fret) % 12;
  return NOTE_NAMES[noteIndex];
}

/**
 * Get the note name and octave at a given fret on a given string
 * @param {number} stringIndex - Index of the string (0-5)
 * @param {number} fret - Fret number (0-16)
 * @returns {Object} - Object with note name and octave (e.g., { note: 'C', octave: 3 })
 */
export function getNoteWithOctaveAtFret(stringIndex, fret) {
  const stringTuning = STRING_TUNINGS[stringIndex];
  const openNoteName = stringTuning.name;
  const openNoteIndex = NOTE_NAMES.indexOf(openNoteName);
  const openMidi = stringTuning.midi;
  
  if (openNoteIndex === -1) {
    throw new Error(`Invalid string tuning: ${stringTuning.name}`);
  }

  // Calculate MIDI note number (add fret to open string MIDI)
  const midiNote = openMidi + fret;
  
  // Calculate octave: MIDI note 0 = C-1, so octave = floor(midi / 12) - 1
  // But we need to account for C being at different positions
  // For guitar, MIDI 40 = E2, MIDI 64 = E4
  // So octave = Math.floor(midi / 12) - 1
  const octave = Math.floor(midiNote / 12) - 1;
  
  // Calculate note name
  const noteIndex = (openNoteIndex + fret) % 12;
  const note = NOTE_NAMES[noteIndex];
  
  return { note, octave };
}

/**
 * Get all fret positions that match notes in the given scale
 * @param {Array<string>} scaleNotes - Array of note names in the scale
 * @param {number} maxFrets - Maximum number of frets to check (default: 16)
 * @returns {Array<Object>} - Array of {stringIndex, fret, note} objects
 */
export function getScalePositions(scaleNotes, maxFrets = 16) {
  const positions = [];
  const scaleNoteSet = new Set(scaleNotes);

  // Check each string
  for (let stringIndex = 0; stringIndex < STRING_TUNINGS.length; stringIndex++) {
    // Check each fret
    for (let fret = 0; fret <= maxFrets; fret++) {
      const note = getNoteAtFret(stringIndex, fret);
      if (scaleNoteSet.has(note)) {
        positions.push({
          stringIndex,
          fret,
          note
        });
      }
    }
  }

  return positions;
}

