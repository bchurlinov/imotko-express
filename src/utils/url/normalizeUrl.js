/**
 * URL normalization utilities for matching referrer domains
 * @module utils/url/normalizeUrl
 */

/**
 * Extracts the domain from a URL
 * @param {string} url - The URL to extract domain from
 * @returns {string|null} - The extracted domain or null if parsing fails
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
}

/**
 * Normalizes a URL for consistent comparison
 * - Extracts hostname from URL
 * - Removes 'www.' prefix
 * - Converts to lowercase
 * - Returns normalized domain string
 *
 * @param {string} url - The URL to normalize
 * @returns {string|null} - The normalized domain or null if URL is malformed
 *
 * @example
 * normalizeUrl('https://www.example.com/path') // returns 'example.com'
 * normalizeUrl('http://Example.COM') // returns 'example.com'
 * normalizeUrl('invalid-url') // returns null
 */
export function normalizeUrl(url) {
  try {
    // Parse the URL
    const urlObj = new URL(url);

    // Extract hostname
    let hostname = urlObj.hostname;

    // Remove 'www.' prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Convert to lowercase for case-insensitive comparison
    hostname = hostname.toLowerCase();

    return hostname;
  } catch (error) {
    // Return null for malformed URLs
    return null;
  }
}
