// Minimal Stripe REST client — no npm package needed
const https = require('https');

function stripeRequest(method, path, data, secretKey) {
  return new Promise((resolve, reject) => {
    const body = data ? Object.entries(flattenObject(data))
      .map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&') : '';

    const options = {
      hostname: 'api.stripe.com',
      path: '/v1' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Stripe-Version': '2023-10-16',
      }
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch(e) { reject(new Error('Parse error: ' + raw)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Flatten nested objects for Stripe's form encoding (e.g. metadata[key]=val)
function flattenObject(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(acc, flattenObject(v, key));
    } else if (v !== null && v !== undefined) {
      acc[key] = v;
    }
    return acc;
  }, {});
}

module.exports = {
  customers: {
    create: (data, key) => stripeRequest('POST', '/customers', data, key),
    retrieve: (id, key) => stripeRequest('GET', '/customers/' + id, null, key),
  },
  checkout: {
    sessions: {
      create: (data, key) => stripeRequest('POST', '/checkout/sessions', data, key),
    }
  },
  billingPortal: {
    sessions: {
      create: (data, key) => stripeRequest('POST', '/billing_portal/sessions', data, key),
    }
  },
  subscriptions: {
    retrieve: (id, key) => stripeRequest('GET', '/subscriptions/' + id, null, key),
    cancel: (id, key) => stripeRequest('DELETE', '/subscriptions/' + id, null, key),
  },
  webhooks: {
    constructEvent: require('../lib/stripe-webhook'),
  }
};
