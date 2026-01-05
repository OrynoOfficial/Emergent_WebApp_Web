// Currency formatting utility for FCFA
// Standard format: 5,000 FCFA (amount with commas, then FCFA)

/**
 * Format amount as FCFA currency
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string (e.g., "5,000 FCFA")
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 FCFA';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${new Intl.NumberFormat('en-US').format(Math.round(num))} FCFA`;
};

/**
 * Format number with commas
 * @param {number|string} num - The number to format
 * @returns {string} Formatted number string (e.g., "5,000")
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-US').format(Math.round(n));
};

/**
 * Parse currency string to number
 * @param {string} str - The currency string to parse
 * @returns {number} Parsed number
 */
export const parseCurrency = (str) => {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9.-]/g, ''), 10) || 0;
};

/**
 * Format amount as FCFA with smaller denominations (compact format)
 * @param {number} amount - The amount to format
 * @returns {string} Compact formatted currency (e.g., "5K FCFA" for 5000)
 */
export const formatCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 FCFA';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M FCFA`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K FCFA`;
  }
  return `${Math.round(num)} FCFA`;
};

export default formatCurrency;

// Alias for backwards compatibility
export { formatCurrency as formatFCFA };
