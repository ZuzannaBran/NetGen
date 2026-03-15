// Text formatting utilities (ported from C utils)

/**
 * Capitalize first letter and lowercase the rest
 * @param {string} str - String to format
 * @returns {string} Formatted string
 */
export function capitalizeFirst(str) {
    if (!str || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert entire string to lowercase
 * @param {string} str - String to convert
 * @returns {string} Lowercase string
 */
export function toLowerCase(str) {
    if (!str) return str;
    return str.toLowerCase();
}

/**
 * Format hashtags array - convert all to lowercase
 * @param {string[]} hashtags - Array of hashtag strings
 * @returns {string[]} Formatted hashtags
 */
export function formatHashtags(hashtags) {
    return hashtags.map((tag) => toLowerCase(tag.trim())).filter((tag) => tag.length > 0);
}

/**
 * Parse comma-separated hashtags string
 * @param {string} hashtagsStr - Comma-separated hashtags
 * @returns {string[]} Array of formatted hashtags
 */
export function parseHashtags(hashtagsStr) {
    if (!hashtagsStr) return [];
    const tags = hashtagsStr
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    return formatHashtags(tags);
}
