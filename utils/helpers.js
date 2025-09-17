const crypto = require('crypto');

/**
 * Generate a unique ID with timestamp and random component
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} - Unique ID
 */
exports.generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
};

/**
 * Generate a session ID for practical training
 * @returns {string} - Session ID in format PT-YYYYMMDD-XXXX
 */
exports.generateSessionId = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PT-${dateStr}-${randomPart}`;
};

/**
 * Generate a training certificate number
 * @param {string} category - Training category
 * @param {string} level - Training level
 * @returns {string} - Certificate number
 */
exports.generateCertificateNumber = (category, level) => {
  const categoryCode = category.substring(0, 3).toUpperCase();
  const levelCode = level.substring(0, 1).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CERT-${categoryCode}-${levelCode}-${timestamp}-${randomPart}`;
};

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'time')
 * @returns {string} - Formatted date string
 */
exports.formatDate = (date, format = 'short') => {
  if (!date) return '';
  
  const d = new Date(date);
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-IN');
    case 'long':
      return d.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'time':
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'datetime':
      return d.toLocaleString('en-IN');
    default:
      return d.toLocaleDateString('en-IN');
  }
};

/**
 * Calculate duration between two dates in days
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} - Duration in days
 */
exports.calculateDuration = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Indian)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone number
 */
exports.isValidPhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

/**
 * Generate a random password
 * @param {number} length - Password length
 * @returns {string} - Random password
 */
exports.generateRandomPassword = (length = 8) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Sanitize string for use in filenames
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
exports.sanitizeFilename = (str) => {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

/**
 * Calculate progress percentage
 * @param {number} completed - Completed items
 * @param {number} total - Total items
 * @returns {number} - Progress percentage (0-100)
 */
exports.calculateProgress = (completed, total) => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
};

/**
 * Check if date is in the past
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is in the past
 */
exports.isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is in the future
 */
exports.isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Get age from date of birth
 * @param {Date} dateOfBirth - Date of birth
 * @returns {number} - Age in years
 */
exports.calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Convert time string to minutes
 * @param {string} timeStr - Time string in format "HH:MM"
 * @returns {number} - Time in minutes
 */
exports.timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes to time string
 * @param {number} minutes - Minutes
 * @returns {string} - Time string in format "HH:MM"
 */
exports.minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Get current Indian Standard Time
 * @returns {Date} - Current IST date
 */
exports.getCurrentIST = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
};

/**
 * Format currency for Indian Rupees
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

/**
 * Slugify string for URLs
 * @param {string} str - String to slugify
 * @returns {string} - Slugified string
 */
exports.slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
exports.deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} - True if object is empty
 */
exports.isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
exports.capitalizeWords = (str) => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};
