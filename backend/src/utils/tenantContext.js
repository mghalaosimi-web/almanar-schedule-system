const { AsyncLocalStorage } = require('async_hooks');
const tenantDbStorage = new AsyncLocalStorage();
module.exports = { tenantDbStorage };
