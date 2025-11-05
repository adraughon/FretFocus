import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import Fretboard from './Fretboard'
import TabRibbon from './components/TabRibbon'
import { KEYS, SCALE_STYLES, getScaleNotes, NOTE_NAMES } from './utils/scales'
import { getScalePositions, getNoteWithOctaveAtFret, STRING_TUNINGS } from './utils/fretCalculator'
import { extractTabContent, isValidTabText, findUniqueCharacterPositions } from './utils/parseTabText'
import { getSeventhChordsFromKey, getChordPositions, CHORD_PATTERNS, getChordNotes } from './utils/chords'
import './App.css'

function App() {
  const [selectedKey, setSelectedKey] = useState('C')
  const [selectedStyle, setSelectedStyle] = useState('Pentatonic')
  const [numFrets, setNumFrets] = useState(16) // Stored value is 16, displayed as 15
  const [pastedTabText, setPastedTabText] = useState('')
  const [tabText, setTabText] = useState('')
  const [error, setError] = useState('')
  const [projectTabToFretboard, setProjectTabToFretboard] = useState(false)
  const [currentTabPosition, setCurrentTabPosition] = useState(null)
  const [currentTabPositionIndex, setCurrentTabPositionIndex] = useState(0)
  
  // Audio context and buffers for playing tab notes
  const audioContextRef = useRef(null)
  const audioBufferCache = useRef(new Map())
  
  // Representative sample for each string (same as in Fretboard)
  const stringSamples = [
    { stringIndex: 0, file: 'E4.wav', note: 'E', octave: 4 },
    { stringIndex: 1, file: 'B4.wav', note: 'B', octave: 4 },
    { stringIndex: 2, file: 'E4.wav', note: 'E', octave: 4 },
    { stringIndex: 3, file: 'D3.wav', note: 'D', octave: 3 },
    { stringIndex: 4, file: 'A3.wav', note: 'A', octave: 3 },
    { stringIndex: 5, file: 'E2.wav', note: 'E', octave: 2 },
  ]

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


  // Memoize playNoteSound to avoid recreating on every render
  const playNoteSoundMemo = useCallback(async (stringIndex, fret) => {
    try {
      const { note: targetNote, octave: targetOctave } = getNoteWithOctaveAtFret(stringIndex, fret);
      const stringSample = stringSamples.find(s => s.stringIndex === stringIndex);
      if (!stringSample) return;
      
      const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const targetNoteIndex = NOTE_NAMES.indexOf(targetNote);
      const targetMidi = (targetOctave + 1) * 12 + targetNoteIndex;
      
      const sampleNoteIndex = NOTE_NAMES.indexOf(stringSample.note);
      const sampleMidi = (stringSample.octave + 1) * 12 + sampleNoteIndex;
      
      const semitonesToShift = targetMidi - sampleMidi;
      const detune = semitonesToShift * 100;
      
      const audioBuffer = await loadStringBuffer(stringIndex);
      if (!audioBuffer) return;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
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
  }, [])

  // Function to play all notes in a tab position
  const playTabPositionNotes = useCallback(async (position) => {
    if (!position || !position.notes || position.notes.length === 0) return;
    
    // Play all notes simultaneously
    for (const note of position.notes) {
      playNoteSoundMemo(note.stringIndex, note.fret);
    }
  }, [playNoteSoundMemo])
  
  // Memoize the onPositionChange callback to prevent infinite loops
  const handlePositionChange = useCallback((currentPos) => {
    setCurrentTabPosition(currentPos)
  }, [])
  
  // Play notes when projectTabToFretboard is turned ON or when position changes (clicking left/right or dragging)
  useEffect(() => {
    if (projectTabToFretboard && currentTabPosition) {
      playTabPositionNotes(currentTabPosition);
    }
  }, [projectTabToFretboard, currentTabPosition, playTabPositionNotes])
  
  // Context state
  const [contextEnabled, setContextEnabled] = useState(false)
  const [selectedChordDegree, setSelectedChordDegree] = useState('I')
  const [useSevenths, setUseSevenths] = useState(true)
  const [selectedFlavor, setSelectedFlavor] = useState('')
  const [flattenRoot, setFlattenRoot] = useState(false)
  const [flavorManuallySet, setFlavorManuallySet] = useState(false)
  const [displayMode, setDisplayMode] = useState('note') // 'note', 'chord', 'key'

  // Map simplified style names to actual scale styles
  const styleMap = {
    'Pentatonic': 'pentatonic-major',
    'Blues Pentatonic': 'pentatonic-minor',
    'Pentatonic +': 'pentatonic-major',
    'Diatonic': 'major'
  }

  // Calculate scale notes and positions (up to numFrets frets)
  // Memoize to prevent recalculation when chord selection changes
  const scalePositions = useMemo(() => {
    const actualStyle = styleMap[selectedStyle] || 'pentatonic-major'
    const scaleNotes = getScaleNotes(selectedKey, actualStyle)
    return getScalePositions(scaleNotes, numFrets)
  }, [selectedKey, selectedStyle, numFrets])

  // Calculate 4th and 7th degree positions for Pentatonic + mode
  const pentatonicPlusPositions = useMemo(() => {
    if (selectedStyle !== 'Pentatonic +') return []
    
    // Get the 4th and 7th degrees from the major scale
    const majorScaleNotes = getScaleNotes(selectedKey, 'major')
    // Major scale has 7 notes: [0, 2, 4, 5, 7, 9, 11] semitones
    // 4th degree is at index 3 (5 semitones), 7th degree is at index 6 (11 semitones)
    const fourthDegree = majorScaleNotes[3]
    const seventhDegree = majorScaleNotes[6]
    
    // Get positions for both notes
    const fourthPositions = getScalePositions([fourthDegree], numFrets)
    const seventhPositions = getScalePositions([seventhDegree], numFrets)
    
    // Create a set of position keys that are already showing pentatonic notes
    const pentatonicPositionKeys = new Set(
      scalePositions.map(pos => `${pos.stringIndex}-${pos.fret}`)
    )
    
    // Filter out positions that are already showing pentatonic scale notes
    const allPositions = [...fourthPositions, ...seventhPositions]
    return allPositions.filter(pos => {
      const positionKey = `${pos.stringIndex}-${pos.fret}`
      return !pentatonicPositionKeys.has(positionKey)
    })
  }, [selectedKey, selectedStyle, numFrets, scalePositions])
  
  // Calculate context chords - get labels based on useSevenths toggle
  const seventhChords = getSeventhChordsFromKey(selectedKey)
  
  // Get chord labels - sevenths or triads based on toggle
  const getChordLabel = (chord, useSevenths) => {
    if (useSevenths) {
      // Use seventh chord labels
      if (chord.voicing === 'half-diminished') {
        return `${chord.note}°`
      }
      return `${chord.note}${chord.voicing === 'maj7' ? 'maj7' : chord.voicing}`
    } else {
      // Use triad labels
      if (chord.degree === 'I' || chord.degree === 'IV' || chord.degree === 'V') {
        return chord.note
      } else if (chord.degree === 'ii' || chord.degree === 'iii' || chord.degree === 'vi') {
        return `${chord.note}m`
      } else if (chord.degree === 'vii') {
        return `${chord.note}°`
      }
      return chord.note
    }
  }

  // Map chord voicing to flavor button value
  const getFlavorFromVoicing = (voicing, useSevenths) => {
    if (useSevenths) {
      // Map to seventh chord flavors
      if (voicing === 'maj7') return 'maj7'
      if (voicing === 'm7') return 'm7'
      if (voicing === '7') return '7'
      if (voicing === 'half-diminished') return 'dim'
      return ''
    } else {
      // Map to triad flavors
      if (voicing === 'maj7' || voicing === '7') return 'Major'
      if (voicing === 'm7') return 'minor'
      if (voicing === 'half-diminished') return 'diminished'
      return ''
    }
  }

  // Convert uppercase roman numeral to lowercase
  const toLowercaseRoman = (roman) => {
    return roman.toLowerCase()
  }

  // Get roman numeral label for chord function
  const getRomanNumeralLabel = (chord, useSevenths) => {
    if (useSevenths) {
      if (chord.voicing === 'maj7') return `${chord.degree}maj7`
      if (chord.voicing === 'm7') return `${toLowercaseRoman(chord.degree)}m7` // lowercase + m7
      if (chord.voicing === '7') return `${chord.degree}7`
      if (chord.voicing === 'half-diminished') return `${toLowercaseRoman(chord.degree)}°`
      return chord.degree
    } else {
      // Triads - use lowercase for minor with "m" suffix
      if (chord.degree === 'I' || chord.degree === 'IV' || chord.degree === 'V') {
        return chord.degree
      } else if (chord.degree === 'ii' || chord.degree === 'iii' || chord.degree === 'vi') {
        return `${chord.degree}m` // lowercase + m for minor triads
      } else if (chord.degree === 'vii') {
        return `${chord.degree}°` // lowercase + ° for diminished
      }
      return chord.degree
    }
  }

  // Get selected chord's roman numeral (accounting for flatten root)
  const getSelectedChordRomanNumeral = () => {
    if (!contextEnabled) return null
    
    const selectedChord = seventhChords.find(chord => chord.degree === selectedChordDegree)
    if (!selectedChord) return null

    // Determine the voicing to use
    let voicing = selectedFlavor || getFlavorFromVoicing(selectedChord.voicing, useSevenths)
    
    // Map flavor button values to actual voicing names
    const flavorToVoicing = {
      'maj7': 'maj7',
      'm7': 'm7',
      '7': '7',
      'dim': 'half-diminished',
      'Major': 'Major',
      'minor': 'minor',
      'diminished': 'diminished',
      'sus2': 'sus2',
      'sus4': 'sus4'
    }
    
    const actualVoicing = flavorToVoicing[voicing] || voicing
    
    // Calculate root note (flatten if needed)
    let rootNote = selectedChord.note
    let isFlattened = false
    if (flattenRoot) {
      const rootIndex = NOTE_NAMES.indexOf(rootNote)
      const flattenedIndex = (rootIndex - 1 + 12) % 12
      rootNote = NOTE_NAMES[flattenedIndex]
      isFlattened = true
    }
    
    // Find the new degree based on the (possibly flattened) root note
    const flattenedChord = seventhChords.find(chord => chord.note === rootNote)
    
    // Build roman numeral label - start with the degree
    let romanNumeral = flattenedChord ? flattenedChord.degree : selectedChord.degree
    
    // Determine if this should be lowercase (minor or diminished)
    const isMinor = actualVoicing === 'm7' || actualVoicing === 'minor'
    const isDiminished = actualVoicing === 'half-diminished' || actualVoicing === 'diminished'
    
    // Convert to lowercase if minor or diminished
    if (isMinor || isDiminished) {
      romanNumeral = toLowercaseRoman(romanNumeral)
    }
    
    // Add flat symbol if flattened
    if (isFlattened) {
      romanNumeral = `b${romanNumeral}`
    }
    
    // Add voicing suffix
    if (useSevenths) {
      if (actualVoicing === 'maj7') {
        romanNumeral = `${romanNumeral}maj7`
      } else if (actualVoicing === 'm7') {
        romanNumeral = `${romanNumeral}m7` // lowercase + m7 (always show "m")
      } else if (actualVoicing === '7') {
        romanNumeral = `${romanNumeral}7`
      } else if (actualVoicing === 'half-diminished') {
        romanNumeral = `${romanNumeral}°`
      }
    } else {
      // Triads - use "m" suffix for minor
      if (actualVoicing === 'Major') {
        // No suffix for major
      } else if (actualVoicing === 'minor') {
        romanNumeral = `${romanNumeral}m` // lowercase + m for minor triads
      } else if (actualVoicing === 'diminished') {
        romanNumeral = `${romanNumeral}°`
      } else if (actualVoicing === 'sus2') {
        romanNumeral = `${romanNumeral}sus2`
      } else if (actualVoicing === 'sus4') {
        romanNumeral = `${romanNumeral}sus4`
      }
    }
    
    return romanNumeral
  }

  // Reset chord selection when key changes
  useEffect(() => {
    setSelectedChordDegree('I')
    setFlavorManuallySet(false)
  }, [selectedKey])

  // Auto-select flavor when chord changes (reset manual flag so new chord picks its default)
  useEffect(() => {
    setFlavorManuallySet(false)
  }, [selectedChordDegree])

  // Auto-select flavor when chord or useSevenths changes (only if flavor hasn't been manually set)
  useEffect(() => {
    const selectedChord = seventhChords.find(chord => chord.degree === selectedChordDegree)
    if (selectedChord && !flavorManuallySet) {
      const autoFlavor = getFlavorFromVoicing(selectedChord.voicing, useSevenths)
      setSelectedFlavor(autoFlavor)
    }
  }, [selectedChordDegree, useSevenths, seventhChords, flavorManuallySet])

  // Reset manual flag when useSevenths changes
  useEffect(() => {
    setFlavorManuallySet(false)
  }, [useSevenths])

  // Calculate resulting chord and its notes
  const getResultingChord = () => {
    if (!contextEnabled) return null
    
    const selectedChord = seventhChords.find(chord => chord.degree === selectedChordDegree)
    if (!selectedChord) return null

    // Determine the voicing to use
    let voicing = selectedFlavor || getFlavorFromVoicing(selectedChord.voicing, useSevenths)
    
    // Map flavor button values to actual voicing names
    const flavorToVoicing = {
      'maj7': 'maj7',
      'm7': 'm7',
      '7': '7',
      'dim': 'half-diminished',
      'Major': 'Major',
      'minor': 'minor',
      'diminished': 'diminished',
      'sus2': 'sus2',
      'sus4': 'sus4'
    }
    
    // If voicing is empty string, use the default from the chord
    if (!voicing || voicing === '') {
      voicing = getFlavorFromVoicing(selectedChord.voicing, useSevenths)
    }
    
    const actualVoicing = flavorToVoicing[voicing] || voicing
    
    // Calculate root note (flatten if needed)
    let rootNote = selectedChord.note
    if (flattenRoot) {
      const rootIndex = NOTE_NAMES.indexOf(rootNote)
      const flattenedIndex = (rootIndex - 1 + 12) % 12
      rootNote = NOTE_NAMES[flattenedIndex]
    }
    
    // Get chord notes - pass key context for diatonic sus4
    const chordNotes = getChordNotes(rootNote, actualVoicing, false, selectedKey)
    
    // Create chord name - ensure 'm' suffix is preserved for minor chords
    let chordName = rootNote
    if (actualVoicing === 'maj7') {
      chordName = `${rootNote}maj7`
    } else if (actualVoicing === 'm7') {
      chordName = `${rootNote}m7`
    } else if (actualVoicing === '7') {
      chordName = `${rootNote}7`
    } else if (actualVoicing === 'half-diminished') {
      chordName = `${rootNote}°`
    } else if (actualVoicing === 'diminished') {
      chordName = `${rootNote}°`
    } else if (actualVoicing === 'minor' || voicing === 'minor') {
      // Explicitly check for 'minor' to ensure 'm' suffix is added
      chordName = `${rootNote}m`
    } else if (actualVoicing === 'Major') {
      chordName = rootNote
    } else if (actualVoicing === 'sus2') {
      chordName = `${rootNote}sus2`
    } else if (actualVoicing === 'sus4') {
      chordName = `${rootNote}sus4`
    } else {
      // Default: if no voicing matches, just use root note
      chordName = rootNote
    }
    
    return {
      name: chordName,
      notes: chordNotes,
      root: rootNote,
      voicing: actualVoicing
    }
  }

  const resultingChord = getResultingChord()

  // Calculate context chord positions for the fretboard
  const contextChordPositions = resultingChord && contextEnabled 
    ? getScalePositions(resultingChord.notes, numFrets)
    : []

  const handleParseTabs = () => {
    if (!pastedTabText.trim()) {
      setError('Please paste tab text')
      return
    }

    setError('')
    
    try {
      const extractedTab = extractTabContent(pastedTabText)
      
      if (!isValidTabText(extractedTab)) {
        setError('Could not find valid tab content. Make sure the text includes lines starting with E|, B|, G|, D|, A| followed by tab characters.')
        setTabText('')
        return
      }

      setTabText(extractedTab)
      setCurrentTabPositionIndex(0)
    } catch (err) {
      setError(err.message || 'Failed to parse tab text. Please check the format and try again.')
      setTabText('')
    }
  }

  // Calculate unique positions for tab navigation
  const tabUniquePositions = tabText ? findUniqueCharacterPositions(tabText) : []

  // Reset position when tab text changes
  useEffect(() => {
    setCurrentTabPositionIndex(0)
  }, [tabText])

  const handleTabPrevious = () => {
    if (currentTabPositionIndex > 0) {
      setCurrentTabPositionIndex(currentTabPositionIndex - 1)
    }
  }

  const handleTabNext = () => {
    if (currentTabPositionIndex < tabUniquePositions.length - 1) {
      setCurrentTabPositionIndex(currentTabPositionIndex + 1)
    }
  }

  // Handle keyboard arrow keys for tab navigation
  useEffect(() => {
    // Only enable keyboard navigation when tab is visible
    if (!tabText) return;

    const handleKeyDown = (e) => {
      // Only handle arrow keys when tab is visible
      if (!tabText) return;
      
      // Check if we're in an input field (don't interfere with typing)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentTabPositionIndex > 0) {
          setCurrentTabPositionIndex(currentTabPositionIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentTabPositionIndex < tabUniquePositions.length - 1) {
          setCurrentTabPositionIndex(currentTabPositionIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabText, currentTabPositionIndex, tabUniquePositions.length])

  return (
    <div className="app">
      <h1>🎯 FretFocus</h1>
      
      <div className="controls">
        <div className="main-controls">
          <div className="main-controls-row">
            <div className="control-group">
              <label htmlFor="key-select">Key:</label>
              <select
                id="key-select"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="select-input"
              >
                {KEYS.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="style-select">Style:</label>
              <select
                id="style-select"
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="select-input"
              >
                <option value="Pentatonic">Pentatonic</option>
                <option value="Blues Pentatonic">Blues Pentatonic</option>
                <option value="Pentatonic +">Pentatonic +</option>
                <option value="Diatonic">Diatonic</option>
              </select>
            </div>

            <div className="control-group">
              <label htmlFor="frets-input">Number of Frets:</label>
              <input
                id="frets-input"
                type="number"
                min="12"
                max="24"
                value={numFrets - 1}
                onChange={(e) => {
                  const inputValue = parseInt(e.target.value) || 15;
                  setNumFrets(Math.max(13, Math.min(25, inputValue + 1)));
                }}
                className="select-input"
              />
            </div>
          </div>

          <div className="control-group">
            <label className="display-mode-label">Display Mode:</label>
            <div className="display-mode-buttons">
              <button
                className={`display-mode-button ${displayMode === 'note' ? 'selected' : ''}`}
                onClick={() => setDisplayMode('note')}
              >
                Note Names
              </button>
              {contextEnabled && (
                <button
                  className={`display-mode-button ${displayMode === 'chord' ? 'selected' : ''}`}
                  onClick={() => setDisplayMode('chord')}
                >
                  Chord Functions
                </button>
              )}
              <button
                className={`display-mode-button ${displayMode === 'key' ? 'selected' : ''}`}
                onClick={() => setDisplayMode('key')}
              >
                Key Functions
              </button>
            </div>
          </div>
        </div>

        {/* Context Section - inline to the right */}
        <div className="context-section">
          <div className="context-header">
            <label className="ios-switch-label" onClick={() => setContextEnabled(!contextEnabled)}>
              <span className="switch-label-text">Use Context</span>
              <button
                type="button"
                className={`ios-switch ${contextEnabled ? 'on' : 'off'}`}
                role="switch"
                aria-checked={contextEnabled}
              >
                <span className="ios-switch-thumb"></span>
              </button>
            </label>

            {contextEnabled && (
              <label htmlFor="use-sevenths" className="toggle-label flatten-root-label use-sevenths-label">
                <input
                  id="use-sevenths"
                  type="checkbox"
                  checked={useSevenths}
                  onChange={(e) => setUseSevenths(e.target.checked)}
                  className="toggle-input"
                />
                <span className="toggle-text">Use Sevenths</span>
              </label>
            )}
          </div>

            {contextEnabled && (
              <>
                <div className="context-chord-buttons">
                  {seventhChords.map(chord => (
                    <div key={chord.degree} className="chord-button-wrapper">
                      <button
                        className={`chord-button ${selectedChordDegree === chord.degree ? 'selected' : ''}`}
                        onClick={() => setSelectedChordDegree(chord.degree)}
                      >
                        {getChordLabel(chord, useSevenths)}
                      </button>
                      <div className="chord-function-label">
                        {getRomanNumeralLabel(chord, useSevenths)}
                      </div>
                    </div>
                  ))}
                </div>
                
              <div className="context-modifiers">
                <div className="modifiers-section">
                  <div className="chord-modifiers-subtitle">Chord Modifiers</div>
                  <div className="flavor-buttons">
                    {(useSevenths ? ['maj7', 'm7', '7', 'dim'] : ['Major', 'minor', 'diminished', 'sus2', 'sus4']).map((flavor, index) => {
                      const isBreakPoint = !useSevenths && index === 2;
                      return (
                        <Fragment key={flavor}>
                          <button
                            className={`flavor-button ${selectedFlavor === flavor ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedFlavor(selectedFlavor === flavor ? '' : flavor)
                              setFlavorManuallySet(true)
                            }}
                          >
                          {flavor}
                        </button>
                        {isBreakPoint && <div className="flavor-break" key={`break-${flavor}`}></div>}
                        </Fragment>
                      );
                    })}
                  </div>
                  
                  <label htmlFor="flatten-root" className="toggle-label flatten-root-label">
                    <input
                      id="flatten-root"
                      type="checkbox"
                      checked={flattenRoot}
                      onChange={(e) => setFlattenRoot(e.target.checked)}
                      className="toggle-input"
                    />
                    <span className="toggle-text">Flatten Root</span>
                  </label>
                </div>
                
                {resultingChord && (
                  <div className="selected-chord-wrapper">
                    <div className="selected-chord-subtitle">Selected Chord</div>
                    <div className="chord-badge">
                      <div className="chord-badge-title">{resultingChord.name}</div>
                      <div className="chord-badge-notes">{resultingChord.notes.join(' ')}</div>
                    </div>
                    <div className="chord-badge-function">
                      {getSelectedChordRomanNumeral()}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Fretboard 
        scalePositions={scalePositions} 
        rootNote={selectedKey} 
        numFrets={numFrets}
        contextChordPositions={contextChordPositions}
        contextEnabled={contextEnabled}
        displayMode={displayMode}
        resultingChord={resultingChord}
        selectedKey={selectedKey}
        projectTabToFretboard={projectTabToFretboard}
        currentTabPosition={currentTabPosition}
        pentatonicPlusPositions={pentatonicPlusPositions}
      />

      <div className="tab-loader-section">
        {!tabText ? (
          <>
            <div className="tab-loader-controls">
              <div className="control-group paste-input-group">
                <label htmlFor="tab-paste-input">Paste Tab Text:</label>
                <textarea
                  id="tab-paste-input"
                  value={pastedTabText}
                  onChange={(e) => setPastedTabText(e.target.value)}
                  placeholder="Paste monospaced tab text here (e.g., E|----------3---5--3...)"
                  className="paste-input"
                  rows={6}
                />
              </div>
              <button
                onClick={handleParseTabs}
                disabled={!pastedTabText.trim()}
                className="load-button"
              >
                Parse Tab
              </button>
            </div>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="tab-display-header">
              <h3>Tab</h3>
              <div className="tab-header-controls">
                <div className="tab-navigation-controls">
                  <button
                    onClick={handleTabPrevious}
                    disabled={currentTabPositionIndex === 0}
                    className="nav-button nav-button-left"
                    aria-label="Previous position"
                  >
                    ←
                  </button>
                  <span className="position-indicator">
                    {tabUniquePositions.length > 0 ? `${currentTabPositionIndex + 1} / ${tabUniquePositions.length}` : '0 / 0'}
                  </span>
                  <button
                    onClick={handleTabNext}
                    disabled={currentTabPositionIndex >= tabUniquePositions.length - 1}
                    className="nav-button nav-button-right"
                    aria-label="Next position"
                  >
                    →
                  </button>
                </div>
                <label className="ios-switch-label" onClick={() => setProjectTabToFretboard(!projectTabToFretboard)}>
                  <span className="switch-label-text">Project onto Fretboard</span>
                  <button
                    type="button"
                    className={`ios-switch ${projectTabToFretboard ? 'on' : 'off'}`}
                    role="switch"
                    aria-checked={projectTabToFretboard}
                  >
                    <span className="ios-switch-thumb"></span>
                  </button>
                </label>
                <button
                  onClick={() => {
                    setTabText('')
                    setPastedTabText('')
                    setError('')
                    setProjectTabToFretboard(false)
                    setCurrentTabPosition(null)
                    setCurrentTabPositionIndex(0)
                  }}
                  className="revert-button"
                >
                  Revert to Paste
                </button>
              </div>
            </div>
            <TabRibbon 
              tabText={tabText}
              currentPositionIndex={currentTabPositionIndex}
              onPositionIndexChange={setCurrentTabPositionIndex}
              uniquePositions={tabUniquePositions}
              onPositionChange={handlePositionChange}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default App

