/**
 * Scale definitions - intervals in semitones from the root note
 */
export const SCALE_PATTERNS = {
  pentatonic: [0, 3, 5, 7, 10], // Minor pentatonic (most common default)
  'pentatonic-major': [0, 2, 4, 7, 9], // Major pentatonic
  'pentatonic-minor': [0, 3, 5, 7, 10], // Minor pentatonic
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

/**
 * All available keys
 */
export const KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

/**
 * All available scale styles
 */
export const SCALE_STYLES = Object.keys(SCALE_PATTERNS);

/**
 * Note names array
 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get the notes in a given scale
 * @param {string} key - The root key (e.g., 'C', 'D#')
 * @param {string} scaleStyle - The scale pattern name (e.g., 'pentatonic', 'major')
 * @returns {Array<string>} - Array of note names in the scale
 */
export function getScaleNotes(key, scaleStyle = 'pentatonic') {
  const keyIndex = NOTE_NAMES.indexOf(key);
  if (keyIndex === -1) {
    throw new Error(`Invalid key: ${key}`);
  }

  const pattern = SCALE_PATTERNS[scaleStyle];
  if (!pattern) {
    throw new Error(`Invalid scale style: ${scaleStyle}`);
  }

  // Generate notes by applying intervals to the root key
  return pattern.map(interval => {
    const noteIndex = (keyIndex + interval) % 12;
    return NOTE_NAMES[noteIndex];
  });
}

