import { useState, useEffect, useRef, useCallback } from 'react'
import { findUniqueCharacterPositions, parseNotesAtColumn } from '../utils/parseTabText'
import { getNoteAtFret } from '../utils/fretCalculator'
import './TabRibbon.css'

function TabRibbon({ tabText, onPositionChange, currentPositionIndex, onPositionIndexChange, uniquePositions }) {
  const [isDragging, setIsDragging] = useState(false)
  const contentRef = useRef(null)
  const highlightRef = useRef(null)
  const dragStartXRef = useRef(0)

  if (!tabText) {
    return null;
  }

  // Split tab text into lines and format for horizontal scrolling
  const lines = tabText.split('\n').filter(line => line.trim().length > 0);

  // Use uniquePositions from props if provided, otherwise calculate them
  const calculatedUniquePositions = uniquePositions || findUniqueCharacterPositions(tabText)

  // Get current column position (handle both old format (number) and new format (object))
  const currentPos = calculatedUniquePositions[currentPositionIndex ?? 0]
  const currentColumn = typeof currentPos === 'object' ? currentPos.column : (currentPos ?? 0)
  const currentWidth = typeof currentPos === 'object' ? currentPos.width : 1

  // Parse notes for current position
  useEffect(() => {
    if (!tabText || calculatedUniquePositions.length === 0) {
      if (onPositionChange) {
        onPositionChange(null)
      }
      return
    }

    // Parse current position notes
    const currentNotes = parseNotesAtColumn(tabText, currentColumn).map(note => ({
      ...note,
      note: getNoteAtFret(note.stringIndex, note.fret)
    }))

    if (onPositionChange) {
      onPositionChange(
        currentNotes.length > 0 ? { column: currentColumn, notes: currentNotes } : null
      )
    }
  }, [currentColumn, tabText, calculatedUniquePositions.length, onPositionChange])

  // Calculate highlight position using actual DOM position
  useEffect(() => {
    if (!contentRef.current || !highlightRef.current || calculatedUniquePositions.length === 0) {
      return
    }

    // Find the first line that has content
    const firstLine = lines.find(line => line.trim().length > 0)
    if (!firstLine) return

    // Find the pipe position to get the offset for content after "E|"
    const pipeIndex = firstLine.indexOf('|')
    if (pipeIndex === -1) return

    // Calculate the actual character position in the line (after the pipe)
    const targetCharIndex = pipeIndex + 1 + currentColumn

    // Use Range API to find the actual rendered position of the target character(s)
    // The structure is: <pre> -> <span className="tab-line"> -> text node
    const firstSpan = contentRef.current.querySelector('.tab-line')
    if (!firstSpan || !firstSpan.firstChild) {
      return
    }

    const textNode = firstSpan.firstChild
    const textContent = textNode.textContent
    
    if (targetCharIndex >= textContent.length) {
      return
    }

    // Create a range for the target character(s) - handle multi-digit numbers
    const range = document.createRange()
    try {
      range.setStart(textNode, targetCharIndex)
      // End position should include all digits in the number (e.g., 10, 12, 15)
      const endIndex = Math.min(targetCharIndex + currentWidth, textContent.length)
      range.setEnd(textNode, endIndex)
    } catch (e) {
      return
    }

    // Get the bounding rectangle of the character(s)
    const charRect = range.getBoundingClientRect()
    const wrapperRect = contentRef.current.parentElement.getBoundingClientRect()
    
    // Calculate position relative to the wrapper (which is positioned relative)
    const leftOffset = charRect.left - wrapperRect.left - 3 // 3px grace on left
    const charWidth = charRect.width

    // Position the highlight with extra width for "grace" on the right edge
    highlightRef.current.style.left = `${leftOffset}px`
    highlightRef.current.style.width = `${charWidth + 6}px`

    // Scroll the highlight into view
    const scrollContainer = contentRef.current.closest('.tab-ribbon-scroll')
    if (scrollContainer && highlightRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (!highlightRef.current) return
        
        const containerRect = scrollContainer.getBoundingClientRect()
        const highlightRect = highlightRef.current.getBoundingClientRect()
        
        if (highlightRect.left < containerRect.left) {
          scrollContainer.scrollLeft += highlightRect.left - containerRect.left - 20
        } else if (highlightRect.right > containerRect.right) {
          scrollContainer.scrollLeft += highlightRect.right - containerRect.right + 20
        }
      })
    }
  }, [currentColumn, lines, calculatedUniquePositions.length])


  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartXRef.current = e.clientX
  }

  // Find the closest position index based on X coordinate (same logic as dragging)
  const findClosestPositionIndex = useCallback((x) => {
    if (!contentRef.current || calculatedUniquePositions.length === 0) {
      return currentPositionIndex ?? 0
    }

    const wrapperRect = contentRef.current.parentElement.getBoundingClientRect()
    const relativeX = x - wrapperRect.left

    // Find the first line to get pipe position
    const firstLine = lines.find(line => line.trim().length > 0)
    if (!firstLine) return currentPositionIndex ?? 0

    const pipeIndex = firstLine.indexOf('|')
    if (pipeIndex === -1) return currentPositionIndex ?? 0

    const firstSpan = contentRef.current.querySelector('.tab-line')
    if (!firstSpan || !firstSpan.firstChild) return currentPositionIndex ?? 0

    const textNode = firstSpan.firstChild
    const textContent = textNode.textContent

    // Find the character position closest to the X coordinate
    let closestIndex = 0
    let minDistance = Infinity

    // Check each unique position to find the closest one
    calculatedUniquePositions.forEach((pos, index) => {
      const column = typeof pos === 'object' ? pos.column : pos
      const charIndex = pipeIndex + 1 + column

      if (charIndex >= textContent.length) return

      try {
        const range = document.createRange()
        range.setStart(textNode, charIndex)
        range.setEnd(textNode, Math.min(charIndex + 1, textContent.length))
        const charRect = range.getBoundingClientRect()
        const charLeft = charRect.left - wrapperRect.left
        const charCenter = charLeft + charRect.width / 2

        const distance = Math.abs(relativeX - charCenter)
        if (distance < minDistance) {
          minDistance = distance
          closestIndex = index
        }
      } catch (e) {
        // Ignore range errors
      }
    })

    return closestIndex
  }, [calculatedUniquePositions, lines, currentPositionIndex])

  // Handle click anywhere on tab area to snap rectangle
  const handleTabAreaClick = (e) => {
    // Don't snap if clicking on the highlight itself (that's for dragging)
    if (e.target === highlightRef.current || highlightRef.current?.contains(e.target)) {
      return
    }
    
    const closestIndex = findClosestPositionIndex(e.clientX)
    const currentIdx = currentPositionIndex ?? 0
    if (onPositionIndexChange && closestIndex !== currentIdx) {
      onPositionIndexChange(closestIndex)
    }
  }

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (!isDragging) return


    const handleGlobalMouseMove = (e) => {
      const closestIndex = findClosestPositionIndex(e.clientX)
      const currentIdx = currentPositionIndex ?? 0
      if (onPositionIndexChange && closestIndex !== currentIdx) {
        onPositionIndexChange(closestIndex)
      }
    }
    
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, findClosestPositionIndex, currentPositionIndex, onPositionIndexChange])

  return (
    <div className="tab-ribbon-container">
      <div className="tab-ribbon-scroll">
        <div 
          className="tab-ribbon-content-wrapper"
          onClick={handleTabAreaClick}
          style={{ cursor: 'pointer' }}
        >
          <pre ref={contentRef} className="tab-ribbon-content">
            {lines.map((line, index) => (
              <span key={index} className="tab-line">
                {line}
                {'\n'}
              </span>
            ))}
          </pre>
          <div 
            ref={highlightRef} 
            className="tab-highlight"
            onMouseDown={handleMouseDown}
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to wrapper
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          />
        </div>
      </div>
    </div>
  );
}

export default TabRibbon

