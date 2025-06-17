require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { processWebhook } = require('./webhookHandler');

const app = express();
const PORT = process.env.PORT || 3012;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AMOCRM to Planfix webhook server is running' });
});

// Webhook endpoint
app.post(WEBHOOK_PATH, async (req, res) => {
  try {
    const inputData = {
      body: req.body,
      amocrm_token: process.env.AMOCRM_TOKEN,
      agent_token: process.env.AGENT_TOKEN
    };

    const result = await processWebhook(inputData);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});

module.exports = app; // for testing
