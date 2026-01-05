/**
 * Activity Logger Utility
 * Logs all user actions including navigation, views, and CRUD operations
 */

import api from '@/api/client';

// Action types for comprehensive logging
export const ACTION_TYPES = {
  // Navigation actions
  'navigation.page_view': 'Viewed a page',
  'navigation.tab_change': 'Changed tab',
  'navigation.modal_open': 'Opened modal',
  'navigation.modal_close': 'Closed modal',
  
  // User actions
  'user.login': 'User logged in',
  'user.logout': 'User logged out',
  'user.profile_view': 'Viewed profile',
  'user.profile_update': 'Updated profile',
  'user.password_change': 'Changed password',
  'user.role_change': 'Role changed',
  
  // Order actions
  'order.view': 'Viewed order details',
  'order.create': 'Created new order',
  'order.update': 'Updated order',
  'order.cancel': 'Cancelled order',
  'order.approve': 'Approved order',
  'order.reject': 'Rejected order',
  'order.complete': 'Completed order',
  'order.list_view': 'Viewed orders list',
  
  // Service actions
  'service.view': 'Viewed service details',
  'service.create': 'Created new service',
  'service.update': 'Updated service',
  'service.delete': 'Deleted service',
  'service.search': 'Searched services',
  'service.approve': 'Approved service',
  'service.reject': 'Rejected service',
  
  // Payment actions
  'payment.initiate': 'Initiated payment',
  'payment.complete': 'Completed payment',
  'payment.fail': 'Payment failed',
  'payment.refund': 'Processed refund',
  'payment.verify': 'Verified payment manually',
  
  // Validation actions
  'validation.ticket_view': 'Viewed ticket for validation',
  'validation.ticket_approve': 'Approved ticket',
  'validation.ticket_reject': 'Rejected ticket',
  'validation.service_approve': 'Approved service submission',
  'validation.service_reject': 'Rejected service submission',
  'validation.payment_verify': 'Verified payment',
  
  // Settings actions
  'settings.view': 'Viewed settings',
  'settings.update': 'Updated settings',
  'settings.commission_change': 'Changed commission settings',
  
  // Report actions
  'report.view': 'Viewed report',
  'report.download': 'Downloaded report',
  'report.export': 'Exported report',
  
  // Management actions
  'management.dashboard_view': 'Viewed management dashboard',
  'management.analytics_view': 'Viewed analytics',
  'management.item_create': 'Created management item',
  'management.item_update': 'Updated management item',
  'management.item_delete': 'Deleted management item',
  
  // Security actions
  'security.login_fail': 'Failed login attempt',
  'security.permission_denied': 'Permission denied',
  'security.suspicious_activity': 'Suspicious activity detected',
};

// Entity types
export const ENTITY_TYPES = {
  USER: 'user',
  ORDER: 'order',
  SERVICE: 'service',
  PAYMENT: 'payment',
  VALIDATION: 'validation',
  SETTINGS: 'settings',
  REPORT: 'report',
  NAVIGATION: 'navigation',
  SECURITY: 'security',
};

/**
 * Main logging function
 * @param {string} action - The action being performed (e.g., 'order.view')
 * @param {string} entityType - The type of entity (e.g., 'order')
 * @param {Object} options - Additional options
 * @param {string} options.entityId - ID of the entity being acted upon
 * @param {string} options.entityName - Name/title of the entity
 * @param {string} options.details - Additional details about the action
 * @param {Object} options.metadata - Extra metadata to store
 */
export const logActivity = async (action, entityType, options = {}) => {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // User not logged in, skip logging
      console.log('[ActivityLogger] Skipping - no auth token');
      return;
    }

    const payload = {
      action,
      entity_type: entityType,
      entity_id: options.entityId || null,
      entity_name: options.entityName || null,
      details: options.details || ACTION_TYPES[action] || action,
      metadata: {
        ...options.metadata,
        url: window.location.pathname,
        timestamp_local: new Date().toISOString(),
        user_agent: navigator.userAgent,
      },
    };

    await api.post('/activity/log', payload);
    console.log('[ActivityLogger] Logged:', action, entityType);
  } catch (error) {
    // Silent fail - don't break the app if logging fails
    console.warn('[ActivityLogger] Failed to log activity:', error.message);
  }
};

/**
 * Convenience methods for common actions
 */
export const activityLogger = {
  // Navigation logging
  pageView: (pageName, path) => logActivity(
    'navigation.page_view',
    ENTITY_TYPES.NAVIGATION,
    { entityName: pageName, details: `Viewed page: ${pageName}`, metadata: { path } }
  ),
  
  tabChange: (tabName, context) => logActivity(
    'navigation.tab_change',
    ENTITY_TYPES.NAVIGATION,
    { entityName: tabName, details: `Changed to tab: ${tabName}`, metadata: { context } }
  ),
  
  modalOpen: (modalName, entityId) => logActivity(
    'navigation.modal_open',
    ENTITY_TYPES.NAVIGATION,
    { entityId, entityName: modalName, details: `Opened modal: ${modalName}` }
  ),
  
  modalClose: (modalName) => logActivity(
    'navigation.modal_close',
    ENTITY_TYPES.NAVIGATION,
    { entityName: modalName, details: `Closed modal: ${modalName}` }
  ),

  // Order logging
  orderView: (orderId, orderNumber) => logActivity(
    'order.view',
    ENTITY_TYPES.ORDER,
    { entityId: orderId, entityName: `Order #${orderNumber}`, details: `Viewed order #${orderNumber}` }
  ),
  
  orderCreate: (orderId, serviceName) => logActivity(
    'order.create',
    ENTITY_TYPES.ORDER,
    { entityId: orderId, entityName: serviceName, details: `Created order for ${serviceName}` }
  ),
  
  orderCancel: (orderId, orderNumber, reason) => logActivity(
    'order.cancel',
    ENTITY_TYPES.ORDER,
    { entityId: orderId, entityName: `Order #${orderNumber}`, details: `Cancelled order #${orderNumber}`, metadata: { reason } }
  ),
  
  orderApprove: (orderId, orderNumber) => logActivity(
    'order.approve',
    ENTITY_TYPES.ORDER,
    { entityId: orderId, entityName: `Order #${orderNumber}`, details: `Approved order #${orderNumber}` }
  ),
  
  orderReject: (orderId, orderNumber, reason) => logActivity(
    'order.reject',
    ENTITY_TYPES.ORDER,
    { entityId: orderId, entityName: `Order #${orderNumber}`, details: `Rejected order #${orderNumber}`, metadata: { reason } }
  ),

  // Service logging
  serviceView: (serviceId, serviceName) => logActivity(
    'service.view',
    ENTITY_TYPES.SERVICE,
    { entityId: serviceId, entityName: serviceName, details: `Viewed service: ${serviceName}` }
  ),
  
  serviceCreate: (serviceId, serviceName, category) => logActivity(
    'service.create',
    ENTITY_TYPES.SERVICE,
    { entityId: serviceId, entityName: serviceName, details: `Created service: ${serviceName}`, metadata: { category } }
  ),
  
  serviceUpdate: (serviceId, serviceName) => logActivity(
    'service.update',
    ENTITY_TYPES.SERVICE,
    { entityId: serviceId, entityName: serviceName, details: `Updated service: ${serviceName}` }
  ),
  
  serviceDelete: (serviceId, serviceName) => logActivity(
    'service.delete',
    ENTITY_TYPES.SERVICE,
    { entityId: serviceId, entityName: serviceName, details: `Deleted service: ${serviceName}` }
  ),

  // Validation logging
  validationApprove: (type, itemId, itemName) => logActivity(
    `validation.${type}_approve`,
    ENTITY_TYPES.VALIDATION,
    { entityId: itemId, entityName: itemName, details: `Approved ${type}: ${itemName}` }
  ),
  
  validationReject: (type, itemId, itemName, reason) => logActivity(
    `validation.${type}_reject`,
    ENTITY_TYPES.VALIDATION,
    { entityId: itemId, entityName: itemName, details: `Rejected ${type}: ${itemName}`, metadata: { reason } }
  ),

  // Payment logging
  paymentInitiate: (paymentId, amount, method) => logActivity(
    'payment.initiate',
    ENTITY_TYPES.PAYMENT,
    { entityId: paymentId, details: `Initiated payment of ${amount}`, metadata: { amount, method } }
  ),
  
  paymentComplete: (paymentId, amount) => logActivity(
    'payment.complete',
    ENTITY_TYPES.PAYMENT,
    { entityId: paymentId, details: `Completed payment of ${amount}`, metadata: { amount } }
  ),
  
  paymentVerify: (paymentId, orderId) => logActivity(
    'payment.verify',
    ENTITY_TYPES.PAYMENT,
    { entityId: paymentId, details: `Manually verified payment for order`, metadata: { orderId } }
  ),

  // User actions
  login: (userId, email) => logActivity(
    'user.login',
    ENTITY_TYPES.USER,
    { entityId: userId, entityName: email, details: `User logged in: ${email}` }
  ),
  
  logout: (userId, email) => logActivity(
    'user.logout',
    ENTITY_TYPES.USER,
    { entityId: userId, entityName: email, details: `User logged out: ${email}` }
  ),
  
  profileUpdate: (userId) => logActivity(
    'user.profile_update',
    ENTITY_TYPES.USER,
    { entityId: userId, details: 'Updated profile information' }
  ),

  // Management actions
  managementItemCreate: (type, itemId, itemName) => logActivity(
    'management.item_create',
    ENTITY_TYPES.SERVICE,
    { entityId: itemId, entityName: itemName, details: `Created ${type}: ${itemName}`, metadata: { type } }
  ),
  
  managementItemUpdate: (type, itemId, itemName) => logActivity(
    'management.item_update',
    ENTITY_TYPES.SERVICE,
    { entityId: itemId, entityName: itemName, details: `Updated ${type}: ${itemName}`, metadata: { type } }
  ),
  
  managementItemDelete: (type, itemId, itemName) => logActivity(
    'management.item_delete',
    ENTITY_TYPES.SERVICE,
    { entityId: itemId, entityName: itemName, details: `Deleted ${type}: ${itemName}`, metadata: { type } }
  ),

  // Report actions
  reportView: (reportId, reportName) => logActivity(
    'report.view',
    ENTITY_TYPES.REPORT,
    { entityId: reportId, entityName: reportName, details: `Viewed report: ${reportName}` }
  ),
  
  reportDownload: (reportId, reportName, format) => logActivity(
    'report.download',
    ENTITY_TYPES.REPORT,
    { entityId: reportId, entityName: reportName, details: `Downloaded report: ${reportName}`, metadata: { format } }
  ),

  // Settings actions
  settingsUpdate: (settingName, oldValue, newValue) => logActivity(
    'settings.update',
    ENTITY_TYPES.SETTINGS,
    { entityName: settingName, details: `Updated setting: ${settingName}`, metadata: { oldValue, newValue } }
  ),

  // Generic search
  search: (query, category, resultsCount) => logActivity(
    'service.search',
    ENTITY_TYPES.SERVICE,
    { details: `Searched for: ${query}`, metadata: { query, category, resultsCount } }
  ),

  // Generic logActivity method for custom actions
  logActivity: logActivity,
};

export default activityLogger;
