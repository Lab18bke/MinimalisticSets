require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const {
  MCSETS_API_KEY,
  STORE_NAME,
  DISCORD_WEBHOOK_URL,
  BASE_URL,
  PORT = 3000,
  SSL_CERT,
  SSL_KEY
} = process.env;

const MCSETS_BASE = 'https://mcsets.com/api/v1/enterprise';
const notifiedSessions = new Set();
let productId = null;

async function mcsets(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${MCSETS_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${MCSETS_BASE}/${endpoint}`, opts);
  return res.json();
}

async function ensureProduct() {
  if (productId) return productId;
  const data = await mcsets('products', 'POST', {
    name: `${STORE_NAME || 'Store'} Payment`,
    description: 'Dynamic payment'
  });
  if (data.success) {
    productId = data.data.id;
    console.log(`Product ready: ${productId}`);
  }
  return productId;
}

app.get('/api/config', (req, res) => {
  res.json({ storeName: STORE_NAME || 'Store' });
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount < 50) {
      return res.status(400).json({ error: 'Minimum amount is £0.50' });
    }

    const pid = await ensureProduct();
    if (!pid) {
      return res.status(500).json({ error: 'Payment setup failed' });
    }

    const priceData = await mcsets('prices', 'POST', {
      product: pid,
      unit_amount: parseInt(amount),
      currency: 'gbp'
    });
    console.log('Price response:', JSON.stringify(priceData, null, 2));

    if (!priceData.success) {
      return res.status(400).json({ error: priceData.error?.message || 'Failed to create price' });
    }

    const sessionData = await mcsets('checkout/sessions', 'POST', {
      price_id: priceData.data.id,
      success_url: `${BASE_URL}/success.html`,
      cancel_url: `${BASE_URL}/cancel.html`
    });
    console.log('Session response:', JSON.stringify(sessionData, null, 2));

    if (!sessionData.success) {
      return res.status(400).json({ error: sessionData.error?.message || 'Failed to create session' });
    }

    res.json({ sessionId: sessionData.data.id });
  } catch (err) {
    console.log('Checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notify-success', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || notifiedSessions.has(sessionId)) {
      return res.json({ received: true });
    }

    notifiedSessions.add(sessionId);

    const verifyData = await mcsets(`checkout/sessions/${sessionId}`);
    const session = verifyData.success ? verifyData.data : null;

    const formattedAmount = session ? (session.amount / 100).toFixed(2) : 'Unknown';
    const currency = session ? session.currency?.toUpperCase() : 'GBP';
    const email = session?.customer_email || 'N/A';

    const embed = {
      embeds: [{
        title: 'Payment Received',
        color: 0x00ff00,
        fields: [
          { name: 'Session', value: sessionId, inline: false },
          { name: 'Amount', value: `£${formattedAmount} ${currency}`, inline: true },
          { name: 'Email', value: email, inline: true },
          { name: 'Store', value: STORE_NAME || 'Store', inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Notification failed' });
  }
});

app.post('/api/webhook/mcsets', async (req, res) => {
  try {
    const event = req.body;

    if (event.type === 'checkout.completed') {
      const { session_id, amount, currency, customer_email } = event.data;

      if (notifiedSessions.has(session_id)) {
        return res.json({ received: true });
      }
      notifiedSessions.add(session_id);

      const formattedAmount = (amount / 100).toFixed(2);

      const embed = {
        embeds: [{
          title: 'Payment Received',
          color: 0x00ff00,
          fields: [
            { name: 'Session', value: session_id, inline: false },
            { name: 'Amount', value: `£${formattedAmount} ${currency.toUpperCase()}`, inline: true },
            { name: 'Email', value: customer_email || 'N/A', inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed)
      });
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

