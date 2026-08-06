const client = require('prom-client');

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const register = client.register;
const fabricInvokeCounter = new client.Counter({ name: 'fabric_invoke_total', help: 'Total fabric invoke attempts' });
const fabricRetryCounter = new client.Counter({ name: 'fabric_retry_total', help: 'Total fabric SDK retries' });

module.exports = { client, register, fabricInvokeCounter, fabricRetryCounter };
