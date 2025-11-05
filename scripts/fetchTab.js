import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const $ = cheerio.load(html);

    // Ultimate Guitar tabs are typically in a <pre> tag or in a div with class containing 'tab'
    // Let's try multiple selectors to find the tab content
    let tabText = null;

    // Try to find the tab in a <pre> tag (most common)
    const preTag = $('pre').first();
    if (preTag.length > 0) {
      tabText = preTag.text().trim();
      if (tabText && tabText.includes('|')) {
        return tabText;
      }
    }

    // Try to find tab in div with class containing 'tab'
    const tabDiv = $('[class*="tab"]').filter((i, el) => {
      const text = $(el).text();
      // Check if it looks like a tab (has multiple lines with numbers and dashes)
      return text.split('\n').length >= 6 && /[-|0-9]/.test(text);
    }).first();

    if (tabDiv.length > 0) {
      tabText = tabDiv.text().trim();
      if (tabText) {
        return tabText;
      }
    }

    // Try to find textarea with tab content
    const textarea = $('textarea').first();
    if (textarea.length > 0) {
      tabText = textarea.val() || textarea.text();
      if (tabText && tabText.trim()) {
        return tabText.trim();
      }
    }

    // Fallback: look for any pre-formatted text block
    const codeBlocks = $('code, pre, [class*="code"]');
    for (let i = 0; i < codeBlocks.length; i++) {
      const text = $(codeBlocks[i]).text().trim();
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

// CLI usage
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const tabUrl = process.argv[2];
  if (!tabUrl) {
    console.error('Usage: node fetchTab.js <tab_url>');
    process.exit(1);
  }

  fetchTabText(tabUrl)
    .then(text => {
      const cleaned = cleanTabText(text);
      console.log(cleaned);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

