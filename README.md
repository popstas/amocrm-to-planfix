# AMOCRM to Planfix Webhook Server

This service receives webhooks from AMOCRM when new leads are created and forwards them to Planfix as tasks.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Docker (optional, for containerized deployment)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file with your configuration:
   ```
   AMOCRM_TOKEN=your_amocrm_access_token
   AGENT_TOKEN=your_planfix_agent_token
   CREATE_TASK_URL=https://bot-dev.stable.popstas.ru/agent/planfix/tool/planfix_create_task
   PORT=3012
   NODE_ENV=development
   WEBHOOK_PATH=/webhooks/266756d043492880d04d1f7e82d75b0e
   ```

## Running the Application

### Development

```bash
npm run dev
```

The server will start on `http://localhost:3012`

### Production

```bash
npm start
```

## Docker

### Build the Docker image

```bash
docker build -t amocrm-to-planfix .
```

### Run the Docker container

```bash
docker run -d \
  --name amocrm-to-planfix \
  -p 3012:3012 \
  --env-file .env \
  amocrm-to-planfix
```

## Webhook Configuration in AMOCRM

1. Go to AMOCRM settings
2. Navigate to Webhooks
3. Add a new webhook with the following settings:
   - URL: `https://your-domain.com/webhook` (or `http://localhost:3012/webhook` for local testing)
   - Events: Select "Lead added"
   - HTTP Method: POST
   - Content Type: application/x-www-form-urlencoded

## API Endpoints

- `GET /` - Health check endpoint
- `POST /webhook` - Webhook endpoint for AMOCRM

## Testing Webhooks

Use `npm run test-webhook` to process a sample webhook. By default it loads data from `./data/body-test.json`.
To specify another file, pass the path as an argument:

```bash
npm run test-webhook -- <path-to-json>
```

## Parsing application/x-www-form-urlencoded

If you log webhook bodies as raw strings, decode them using the helper in `src/formParser.js`:

```js
const { parseFormEncoded } = require("./src/formParser");
const data = parseFormEncoded(rawBody);
console.log(JSON.stringify(data, null, 2));
```


## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Port to run the server on (default: 3012) |
| `NODE_ENV` | No | Node environment (development/production) |
| `AMOCRM_TOKEN` | Yes | AMOCRM OAuth access token |
| `AGENT_TOKEN` | Yes | Planfix agent token |
| `CREATE_TASK_URL` | No | Planfix task creation endpoint (default: provided URL) |
| `WEBHOOK_PATH` | No | Webhook path to listen on (default: `/webhook`) |

## License

ISC
