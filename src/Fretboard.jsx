import { useState, useEffect, useRef } from 'react'
import './Fretboard.css'
import { getChordFunction, getKeyFunction } from './utils/chords'
import { getNoteWithOctaveAtFret, STRING_TUNINGS } from './utils/fretCalculator'

function Fretboard({ scalePositions = [], rootNote = '', numFrets = 16, contextChordPositions = [], contextEnabled = false, displayMode = 'note', resultingChord = null, selectedKey = '', projectTabToFretboard = false, currentTabPosition = null, pentatonicPlusPositions = [] }) {
  const strings = 6; // 6 strings
  const frets = numFrets; // Number of frets shown
  const stringNames = ['e', 'b', 'G', 'D', 'A', 'E']; // String names (high E to low E, top to bottom)

  // Track window width for responsive scaling
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );


  useEffect(() => {
    const handleResize = () => {
      // Force state update to trigger re-render
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
    }
    
    // Use resize event with passive listener for better performance
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create a map for quick lookup of scale positions
  const scalePositionMap = new Map();
  scalePositions.forEach(pos => {
    const key = `${pos.stringIndex}-${pos.fret}`;
    scalePositionMap.set(key, pos);
  });
  
  // Create a map for quick lookup of context chord positions
  const contextChordPositionMap = new Map();
  if (contextEnabled && contextChordPositions) {
    contextChordPositions.forEach(pos => {
      const key = `${pos.stringIndex}-${pos.fret}`;
      contextChordPositionMap.set(key, pos);
    });
  }

  // Create maps for tab positions
  const currentTabPositionMap = new Map();
  
  if (projectTabToFretboard && currentTabPosition && currentTabPosition.notes) {
    currentTabPosition.notes.forEach(note => {
      const key = `${note.stringIndex}-${note.fret}`;
      currentTabPositionMap.set(key, note);
    });
  }

  // Create a map for pentatonic plus positions (4th and 7th degrees)
  const pentatonicPlusPositionMap = new Map();
  pentatonicPlusPositions.forEach(pos => {
    const key = `${pos.stringIndex}-${pos.fret}`;
    pentatonicPlusPositionMap.set(key, pos);
  });
  
  // Helper function to get label for a chord position based on display mode
  const getChordPositionLabel = (position) => {
    if (!resultingChord) return null;
    
    if (displayMode === 'note') {
      return position.note;
    } else if (displayMode === 'chord') {
      const voicing = resultingChord.voicing || 'Major';
      const chordRoot = resultingChord.root || position.note;
      return getChordFunction(position.note, chordRoot, voicing);
    } else if (displayMode === 'key') {
      return getKeyFunction(position.note, selectedKey);
    }
    return null;
  }

  // Helper function to get label for a scale note based on display mode (when context is disabled)
  const getScaleNoteLabel = (position) => {
    if (displayMode === 'note') {
      return position.note;
    } else if (displayMode === 'key') {
      return getKeyFunction(position.note, selectedKey);
    }
    return null;
  }

  // Helper function to get sound file path for a note and octave
  const getSoundFilePath = (note, octave) => {
    // Sound files are named like: A2.wav, B3.wav, C#3.wav, etc.
    // Note name already contains # for sharps (e.g., "C#")
    const fileName = `${note}${octave}.wav`;
    // Use import.meta.env.BASE_URL to get the base path (e.g., '/FretFocus/' in production)
    return `${import.meta.env.BASE_URL}acoustic_guitar_sound_pack/${fileName}`;
  }

  // Web Audio API context for pitch-shifting
  const audioContextRef = useRef(null);
  
  // Cache of audio buffers - one per string
  const audioBufferCache = useRef(new Map());
  
  // Representative sample for each string (one sample per string, pitch-shifted for all frets)
  // Each sample is the open string note if available, otherwise closest match
  const stringSamples = [
    { stringIndex: 0, file: 'E4.wav', note: 'E', octave: 4 },   // High E string - open = E4
    { stringIndex: 1, file: 'B4.wav', note: 'B', octave: 4 },   // B string - open = B3, use B4
    { stringIndex: 2, file: 'E4.wav', note: 'E', octave: 4 },   // G string - open = G3, use E4
    { stringIndex: 3, file: 'D3.wav', note: 'D', octave: 3 },   // D string - open = D3
    { stringIndex: 4, file: 'A3.wav', note: 'A', octave: 3 },   // A string - open = A2, use A3
    { stringIndex: 5, file: 'E2.wav', note: 'E', octave: 2 },   // Low E string - open = E2
  ];

  // Helper to load audio buffer for a string
  const loadStringBuffer = async (stringIndex) => {
    const stringSample = stringSamples.find(s => s.stringIndex === stringIndex);
    if (!stringSample) return null;
    
    const filePath = `${import.meta.env.BASE_URL}acoustic_guitar_sound_pack/${stringSample.file}`;
    
    if (audioBufferCache.current.has(filePath)) {
      return audioBufferCache.current.get(filePath);
    }
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    try {
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferCache.current.set(filePath, audioBuffer);
      return audioBuffer;
    } catch (error) {
      return null;
    }
  }

  // Function to play note sound with pitch-shifting
  const playNoteSound = async (stringIndex, fret) => {
    try {
      // Get the target note and the open string note
      const { note: targetNote, octave: targetOctave } = getNoteWithOctaveAtFret(stringIndex, fret);
      const stringTuning = STRING_TUNINGS[stringIndex];
      const openNoteName = stringTuning.name;
      const openMidi = stringTuning.midi;
      
      // Get the sample for this string
      const stringSample = stringSamples.find(s => s.stringIndex === stringIndex);
      if (!stringSample) return;
      
      // Calculate MIDI notes
      const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const targetNoteIndex = NOTE_NAMES.indexOf(targetNote);
      const targetMidi = (targetOctave + 1) * 12 + targetNoteIndex;
      
      const sampleNoteIndex = NOTE_NAMES.indexOf(stringSample.note);
      const sampleMidi = (stringSample.octave + 1) * 12 + sampleNoteIndex;
      
      // Calculate how many semitones to shift from sample to target
      const semitonesToShift = targetMidi - sampleMidi;
      const detune = semitonesToShift * 100; // Convert semitones to cents
      
      // Load the representative sample for this string
      const audioBuffer = await loadStringBuffer(stringIndex);
      
      if (!audioBuffer) {
        return; // No audio available
      }
      
      // Play using Web Audio API
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Create gain node for fade-out envelope
      const gainNode = audioContextRef.current.createGain();
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.detune.value = detune;
      
      // Connect: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      // Apply triangular fade-out envelope (ramp down to silence quickly)
      const fadeDuration = 0.3; // 0.3 seconds fade (shorter for quicker cutoff)
      const currentTime = audioContextRef.current.currentTime;
      const duration = audioBuffer.duration;
      
      // Start at full volume
      gainNode.gain.setValueAtTime(1.0, currentTime);
      
      // Ramp down to silence using linear (triangular) envelope
      // Start fade earlier to cut off tails more aggressively
      // Fade starts at 0.2 seconds into the sample, or immediately if duration is short
      const fadeStartTime = currentTime + Math.min(0.2, duration * 0.3);
      const fadeEndTime = fadeStartTime + fadeDuration;
      gainNode.gain.linearRampToValueAtTime(0, fadeEndTime);
      
      source.start(0);
    } catch (error) {
      // Silently handle errors
    }
  }

  // String thickness progression (thinner at top, thicker at bottom)
  const stringThicknesses = [2, 2.5, 3, 3.5, 4, 4.5]; // in pixels

  // Geometric fret spacing calculation
  // Total scale length is CONSTANT - does not change with number of frets
  // Container is 95vw, with 1rem padding on each side (16px each = 32px total)
  // Account for padding, string labels (50px), and minimal margin
  const containerPadding = 32; // 1rem padding on each side (from CSS)
  const stringLabelWidth = 50;
  const nutWidth = 20;
  // Container width is 95vw, so calculate available width within that container
  const containerWidth = windowWidth * 0.95;
  // Available width for fretboard = container width - padding - string label - nut
  const availableWidth = containerWidth - containerPadding - stringLabelWidth - nutWidth;
  // This is the FIXED total scale length - always the same regardless of number of frets
  // This represents the width from nut to where the last fret would be positioned
  // Use 100% of available width to fit within the container
  const totalScaleLength = Math.max(1000, availableWidth);
  
  // Debug: log to verify calculations are updating
  // console.log('Window width:', windowWidth, 'Container width:', containerWidth, 'Available width:', availableWidth, 'Scale length:', totalScaleLength);
  
  // Calculate cumulative distances from nut to each fret using geometric progression
  // The total scale length is FIXED - always the same regardless of number of frets
  // Distance from nut to fret n follows geometric progression: L * (1 - 2^(-n/12))
  // We normalize so the last displayed fret always reaches totalScaleLength
  // Calculate the geometric ratio for the last fret
  const lastFretRatio = 1 - Math.pow(2, -frets / 12);
  
  // Calculate fret distances - normalize so last fret is at totalScaleLength
  const fretDistances = Array.from({ length: frets + 1 }, (_, n) => {
    if (n === 0) return 0;
    // Calculate geometric ratio for this fret
    const fretRatio = 1 - Math.pow(2, -n / 12);
    // Scale to totalScaleLength, normalizing by the last fret ratio
    return (fretRatio / lastFretRatio) * totalScaleLength;
  });
  
  // Calculate widths of each fret space (distance between adjacent frets)
  const fretWidths = Array.from({ length: frets + 1 }, (_, n) => {
    if (n === 0) return nutWidth;
    if (n === frets) return 0; // No space after last fret
    return fretDistances[n] - fretDistances[n - 1];
  });
  
  // Calculate cumulative start positions for each fret box based on actual rendered widths
  // Each fret box is rendered sequentially, so we sum up the widths
  const fretBoxStartPositions = Array.from({ length: frets + 1 }, (_, n) => {
    if (n === 0) return 0; // Nut starts at position 0
    let cumulative = nutWidth;
    for (let i = 1; i < n; i++) {
      cumulative += fretWidths[i];
    }
    return cumulative;
  });

  return (
    <div className="fretboard-container">
      <div className="fretboard-wrapper" style={{ position: 'relative' }}>
        {/* Fret numbers row */}
        <div className="fret-numbers-row">
          <div className="string-label-space"></div>
          {Array.from({ length: frets }).map((_, fretIndex) => {
            // Calculate position to center over the actual rendered fret boxes
            // The frets are flex children after the 50px string-label
            // So they start at 50px from the start of the string-container
            const stringLabelWidth = 50;
            let leftOffset = stringLabelWidth;
            
            // Get the start position of this fret box and its width
            const fretBoxStart = fretBoxStartPositions[fretIndex];
            const fretBoxWidth = fretWidths[fretIndex];
            
            // Center the number over this fret box
            leftOffset += fretBoxStart + fretBoxWidth / 2;
            
            return (
              <div 
                key={fretIndex} 
                className="fret-number" 
                style={{ 
                  // Display numbers from 0 to frets-1 (e.g., 0-15 for 16 frets)
                  left: `${leftOffset}px`
                }}
              >
                {fretIndex}
              </div>
            );
          })}
        </div>
        
        <div className="fretboard">
          {/* Strings (horizontal lines) - high E at top, low E at bottom */}
          {Array.from({ length: strings }).map((_, stringIndex) => (
            <div key={stringIndex} className="string-container">
              {/* String label */}
              <div className="string-label">{stringNames[stringIndex]}</div>
              
              {/* Steel string - progressively thicker */}
              <div 
                className="steel-string"
                style={{
                  height: `${stringThicknesses[stringIndex]}px`
                }}
              ></div>
              
              {/* Frets (vertical rectangles) */}
              {Array.from({ length: frets + 1 }).map((_, fretIndex) => {
                const positionKey = `${stringIndex}-${fretIndex}`;
                const isScaleNote = scalePositionMap.has(positionKey);
                
                return (
                  <div
                    key={fretIndex}
                    className={`fret ${fretIndex === 0 ? 'nut' : ''} ${fretIndex === frets ? 'last-fret' : ''}`}
                    style={{
                      // Use geometric spacing for fret widths
                      width: fretWidths[fretIndex] > 0 ? `${fretWidths[fretIndex]}px` : '0',
                      // Alternate shading: odd frets (1,3,5,7,9,11,13,15) lighter; even frets (2,4,6,8,10,12,14,16) darker
                      // 12th fret space is slightly darker with a redder, browner color
                      backgroundColor: fretIndex === 0 ? 'transparent' : 
                        (fretIndex === 12 ? '#c4a882' :
                        (fretIndex % 2 === 1 ? '#f0e6d2' : '#e8dcc0')),
                      // Add some depth with box shadow on frets
                      boxShadow: fretIndex > 0 ? 'inset 0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer', // Show pointer cursor to indicate clickability
                    }}
                    onClick={() => playNoteSound(stringIndex, fretIndex)}
                  >
                    {/* Fret wire (small dark line) */}
                    {fretIndex > 0 && (
                      <div className="fret-wire" />
                    )}
                    
                    {/* Scale note circle or square (square for root notes) */}
                    {isScaleNote && (() => {
                      const positionData = scalePositionMap.get(positionKey);
                      // Root note check: compare position note with rootNote (which is selectedKey in key mode)
                      const isRootNote = positionData && rootNote && positionData.note === rootNote;
                      
                      // Root notes: blue squares when context OFF, white squares with transparent middle when context ON
                      if (isRootNote) {
                        const label = getScaleNoteLabel(positionData);
                        if (contextEnabled) {
                          // White square with transparent middle when context is on
                          return (
                            <div className="context-root-note-square">
                              {label && (
                                <span className="scale-note-label">{label}</span>
                              )}
                            </div>
                          );
                        } else {
                          // Blue square when context is off
                          return (
                            <div className="scale-note-square">
                              {label && (
                                <span className="scale-note-label">{label}</span>
                              )}
                            </div>
                          );
                        }
                      }
                      
                      // When context is enabled, style non-root scale notes with white outline/transparent middle
                      if (contextEnabled) {
                        return (
                          <div className="context-chord-note" />
                        );
                      }
                      
                      // When context is disabled, use colored circles for non-root notes
                      const label = getScaleNoteLabel(positionData);
                      return (
                        <div className="scale-note-circle">
                          {label && (
                            <span className="scale-note-label">{label}</span>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Selected chord bubble (square for root "1", circle otherwise) - appears when context is enabled */}
                    {contextEnabled && contextChordPositionMap.has(positionKey) && (() => {
                      const chordPosition = contextChordPositionMap.get(positionKey);
                      const label = getChordPositionLabel(chordPosition);
                      // Check if this note is the root by comparing with resultingChord.root
                      const isRootNote = resultingChord && chordPosition.note === resultingChord.root;
                      
                      return (
                        <div className={isRootNote ? "selected-chord-bubble-square" : "selected-chord-bubble-circle"}>
                          {label && (
                            <span className="selected-chord-label">{label}</span>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Tiny key bubbles for Pentatonic + mode (4th and 7th degrees) */}
                    {pentatonicPlusPositionMap.has(positionKey) && (
                      <div className={contextEnabled ? "tiny-key-bubble-context" : "tiny-key-bubble"} />
                    )}

                    {/* Tab position markers - current position (circle with dashes) */}
                    {projectTabToFretboard && currentTabPositionMap.has(positionKey) && (
                      <div className="tab-position-marker" data-position-key={positionKey}>
                        <svg className="tab-position-crosshair" width="36" height="36" viewBox="0 0 36 36">
                          {/* Small red hollow circle */}
                          <circle cx="18" cy="18" r="8" fill="none" stroke="#ff4757" strokeWidth="2" opacity="0.9"/>
                          {/* Top dash */}
                          <line x1="18" y1="10" x2="18" y2="4" stroke="#ff4757" strokeWidth="2" opacity="0.8"/>
                          {/* Bottom dash */}
                          <line x1="18" y1="26" x2="18" y2="32" stroke="#ff4757" strokeWidth="2" opacity="0.8"/>
                          {/* Left dash */}
                          <line x1="10" y1="18" x2="4" y2="18" stroke="#ff4757" strokeWidth="2" opacity="0.8"/>
                          {/* Right dash */}
                          <line x1="26" y1="18" x2="32" y2="18" stroke="#ff4757" strokeWidth="2" opacity="0.8"/>
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Fretboard

