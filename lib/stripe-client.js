// Zero-dependency Stripe REST client
const https = require('https');

function stripeRequest(method, path, data, secretKey) {
  return new Promise((resolve, reject) => {
    // Encode data — keys may already use Stripe's bracket notation (e.g. line_items[0][price])
    // so we do NOT run flattenObject — just encode the flat key/value pairs directly
    const body = data
      ? Object.entries(data)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
          .join('&')
      : '';

    const options = {
      hostname: 'api.stripe.com',
      path: '/v1' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Stripe-Version': '2023-10-16',
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', d => (raw += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          // Stripe returns error objects with an 'error' key — surface them
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('Parse error: ' + raw.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  customers: {
    create: (data, key) => stripeRequest('POST', '/customers', data, key),
    retrieve: (id, key) => stripeRequest('GET', '/customers/' + id, null, key),
  },
  checkout: {
    sessions: {
      create: (data, key) => stripeRequest('POST', '/checkout/sessions', data, key),
    },
  },
  billingPortal: {
    sessions: {
      create: (data, key) => stripeRequest('POST', '/billing_portal/sessions', data, key),
    },
  },
  subscriptions: {
    retrieve: (id, key) => stripeRequest('GET', '/subscriptions/' + id, null, key),
    cancel: (id, key) => stripeRequest('DELETE', '/subscriptions/' + id, null, key),
  },
};
