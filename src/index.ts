import './logger.js';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { addWebhook } from './queue.js';
import { config } from './config.js';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3012;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AMOCRM to Planfix webhook server is running' });
});

for (const wh of config.webhooks || []) {
  const route = wh.webhook_path.startsWith('/') ? wh.webhook_path : `/${wh.webhook_path}`;
  app.post(route, async (req, res) => {
    try {
      await addWebhook(wh.name, req.body);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error queueing webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

const filename = fileURLToPath(import.meta.url);
if (process.argv[1] === filename) {
  app.listen(Number(PORT), () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Environment:', process.env.NODE_ENV || 'development');
  });
}

export default app;
