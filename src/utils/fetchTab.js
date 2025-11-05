/**
 * Browser-compatible utility to fetch and parse guitar tabs from Ultimate Guitar
 */

/**
 * Fetches a guitar tab from Ultimate Guitar and extracts the monospaced text representation
 * @param {string} tabUrl - The Ultimate Guitar tab URL
 * @returns {Promise<string>} - The monospaced text representation of the tab
 */
export async function fetchTabText(tabUrl) {
  try {
    // Fetch the HTML page
    const response = await fetch(tabUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tab: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    // Parse HTML using DOMParser (browser-compatible)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Ultimate Guitar tabs are typically in a <pre> tag or in a div with class containing 'tab'
    let tabText = null;

    // Try to find the tab in a <pre> tag (most common)
    const preTag = doc.querySelector('pre');
    if (preTag) {
      tabText = preTag.textContent?.trim();
      if (tabText && tabText.includes('|')) {
        return tabText;
      }
    }

    // Try to find tab in div with class containing 'tab'
    const tabDivs = doc.querySelectorAll('[class*="tab"]');
    for (const div of tabDivs) {
      const text = div.textContent || '';
      // Check if it looks like a tab (has multiple lines with numbers and dashes)
      const lines = text.split('\n');
      if (lines.length >= 6 && /[-|0-9]/.test(text)) {
        tabText = text.trim();
        if (tabText) {
          return tabText;
        }
      }
    }

    // Try to find textarea with tab content
    const textarea = doc.querySelector('textarea');
    if (textarea) {
      tabText = textarea.value || textarea.textContent || '';
      if (tabText.trim()) {
        return tabText.trim();
      }
    }

    // Try to find the tab in a specific Ultimate Guitar structure
    // Ultimate Guitar often uses a div with data-value or data-content
    const tabContainers = doc.querySelectorAll('[data-value], [data-content], [class*="js-tab-content"]');
    for (const container of tabContainers) {
      const text = container.textContent || container.getAttribute('data-value') || container.getAttribute('data-content') || '';
      if (text && text.split('\n').length >= 6 && /[-|0-9]/.test(text)) {
        return text.trim();
      }
    }

    // Fallback: look for any pre-formatted text block
    const codeBlocks = doc.querySelectorAll('code, pre, [class*="code"]');
    for (const block of codeBlocks) {
      const text = block.textContent?.trim() || '';
      if (text && text.split('\n').length >= 6 && /[-|0-9]/.test(text)) {
        return text;
      }
    }

    throw new Error('Could not find tab content in the HTML');
  } catch (error) {
    throw new Error(`Error fetching tab: ${error.message}`);
  }
}

/**
 * Cleans and normalizes tab text to ensure consistent formatting
 * @param {string} tabText - Raw tab text
 * @returns {string} - Cleaned tab text
 */
export function cleanTabText(tabText) {
  // Split into lines and filter out empty lines
  let lines = tabText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Find the 6 string lines (they should have consistent structure with dashes, numbers, and pipes)
  const stringLines = lines.filter(line => {
    // String lines typically have dashes, numbers (fret numbers), and possibly pipes
    const hasTabChars = /[-|0-9]/.test(line);
    // Should be reasonably long (tabs are horizontal)
    return hasTabChars && line.length > 20;
  });

  // If we found exactly 6 or more, take the first 6
  if (stringLines.length >= 6) {
    return stringLines.slice(0, 6).join('\n');
  }

  // Otherwise return all lines that look like strings
  return stringLines.join('\n') || tabText;
}

