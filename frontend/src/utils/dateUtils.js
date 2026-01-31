/**
 * Date and Time Utilities for Oryno
 * Timezone: Africa/Douala (Cameroon, UTC+1)
 * Date Format: DD.MM.YYYY
 */

// Cameroon timezone
export const TIMEZONE = 'Africa/Douala';
export const LOCALE = 'fr-CM'; // French Cameroon locale for DD.MM.YYYY format

/**
 * Check if a datetime has passed (is in the past)
 * @param {string|Date} dateInput - Date string or Date object
 * @param {string} timeStr - Optional time string (HH:mm or HH:mm AM/PM)
 * @returns {boolean} True if the datetime is in the past
 */
export const isPast = (dateInput, timeStr = null) => {
  if (!dateInput) return false;
  try {
    let dateTime;
    
    if (timeStr) {
      // Parse time string
      let hours = 0, minutes = 0;
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const period = timeMatch[3];
        if (period) {
          if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
      }
      
      const date = new Date(dateInput);
      date.setHours(hours, minutes, 0, 0);
      dateTime = date;
    } else {
      dateTime = new Date(dateInput);
    }
    
    if (isNaN(dateTime.getTime())) return false;
    return dateTime < new Date();
  } catch {
    return false;
  }
};

/**
 * Check if a date is today
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {boolean} True if the date is today
 */
export const isToday = (dateInput) => {
  if (!dateInput) return false;
  try {
    const date = new Date(dateInput);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch {
    return false;
  }
};

/**
 * Check if a showtime/departure has passed today
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeStr - Time string (HH:mm or HH:mm AM/PM)
 * @returns {boolean} True if the showtime has passed
 */
export const isShowtimePast = (dateStr, timeStr) => {
  return isPast(dateStr, timeStr);
};

/**
 * Format date to DD.MM.YYYY
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  } catch {
    return '-';
  }
};

/**
 * Format date and time to DD.MM.YYYY HH:mm
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
};

/**
 * Format date with full month name: DD Month YYYY
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string
 */
export const formatDateLong = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: TIMEZONE
    });
  } catch {
    return '-';
  }
};

/**
 * Format date with short month: DD Mon YYYY
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string
 */
export const formatDateShort = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: TIMEZONE
    });
  } catch {
    return '-';
  }
};

/**
 * Format time only: HH:mm
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted time string
 */
export const formatTime = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
  } catch {
    return '-';
  }
};

/**
 * Get relative time (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Relative time string
 */
export const getTimeAgo = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return formatDate(date);
  } catch {
    return '-';
  }
};

/**
 * Format date for input fields (YYYY-MM-DD)
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} ISO date string for input
 */
export const formatDateForInput = (dateInput) => {
  if (!dateInput) return '';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

/**
 * Parse DD.MM.YYYY string to Date object
 * @param {string} dateStr - Date string in DD.MM.YYYY format
 * @returns {Date|null} Date object or null
 */
export const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    return new Date(year, month, day);
  } catch {
    return null;
  }
};

/**
 * Get current date in Cameroon timezone
 * @returns {Date} Current date
 */
export const getCurrentDate = () => {
  return new Date();
};

/**
 * Format currency (XAF - Central African CFA franc)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Format number with locale separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('fr-CM').format(num);
};

export default {
  formatDate,
  formatDateTime,
  formatDateLong,
  formatDateShort,
  formatTime,
  getTimeAgo,
  formatDateForInput,
  parseDateString,
  getCurrentDate,
  formatCurrency,
  formatNumber,
  TIMEZONE,
  LOCALE
};
