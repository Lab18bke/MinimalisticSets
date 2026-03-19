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
  PORT = 3000
} = process.env;

const MCSETS_BASE = 'https://mcsets.com/api/v1/enterprise';
const notifiedLinks = new Set();

app.get('/api/config', (req, res) => {
  res.json({ storeName: STORE_NAME || 'Store' });
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount < 50) {
      return res.status(400).json({ error: 'Minimum amount is £0.50' });
    }

    const response = await fetch(`${MCSETS_BASE}/checkout/links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCSETS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: `${STORE_NAME || 'Store'} Payment`,
        amount: parseInt(amount),
        currency: 'gbp',
        success_url: `${BASE_URL}/success.html`,
        cancel_url: `${BASE_URL}/cancel.html`
      })
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(400).json({ error: data.error?.message || 'Failed to create checkout' });
    }

    res.json({ sessionId: data.data.id, url: data.data.url });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notify-success', async (req, res) => {
  try {
    const { linkId } = req.body;

    if (!linkId || notifiedLinks.has(linkId)) {
      return res.json({ received: true });
    }

    notifiedLinks.add(linkId);

    const verifyRes = await fetch(`${MCSETS_BASE}/checkout/links/${linkId}`, {
      headers: {
        'Authorization': `Bearer ${MCSETS_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    const verifyData = await verifyRes.json();
    const link = verifyData.success ? verifyData.data : null;

    const formattedAmount = link ? (link.amount / 100).toFixed(2) : 'Unknown';
    const currency = link ? link.currency.toUpperCase() : 'GBP';

    const embed = {
      embeds: [{
        title: 'Payment Received',
        color: 0x00ff00,
        fields: [
          { name: 'Link ID', value: linkId, inline: false },
          { name: 'Amount', value: `£${formattedAmount} ${currency}`, inline: true },
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
  console.log(`Server running on port ${PORT}`);
});
