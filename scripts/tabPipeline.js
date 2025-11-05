/**
 * Complete pipeline: fetch tab from Ultimate Guitar, parse it, and extract stepwise data
 */
import { fetchTabText, cleanTabText } from './fetchTab.js';
import { parseTab, formatParsedTab } from './parseTab.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Fetches and parses a tab from Ultimate Guitar
 * @param {string} tabUrl - The Ultimate Guitar tab URL
 * @returns {Promise<Object>} - Object containing raw text, cleaned text, and parsed steps
 */
export async function fetchAndParseTab(tabUrl) {
  try {
    // Step 1: Fetch the tab text
    console.log(`Fetching tab from: ${tabUrl}`);
    const rawText = await fetchTabText(tabUrl);
    
    // Step 2: Clean the text
    const cleanedText = cleanTabText(rawText);
    
    // Step 3: Parse the tab
    const steps = parseTab(cleanedText);
    
    return {
      rawText,
      cleanedText,
      steps,
      stepCount: steps.length
    };
  } catch (error) {
    throw new Error(`Pipeline error: ${error.message}`);
  }
}

// CLI usage
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const tabUrl = process.argv[2];
  if (!tabUrl) {
    console.error('Usage: node tabPipeline.js <tab_url>');
    process.exit(1);
  }

  fetchAndParseTab(tabUrl)
    .then(result => {
      console.log('\n=== CLEANED TAB TEXT ===\n');
      console.log(result.cleanedText);
      console.log('\n=== PARSED STEPWISE DATA ===\n');
      console.log(formatParsedTab(result.steps));
      console.log(`\nTotal steps: ${result.stepCount}`);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

