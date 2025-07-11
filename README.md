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
   # AGENT_TOKEN and CREATE_TASK_URL may be specified here or in config.yml
   AGENT_TOKEN=your_planfix_agent_token
   CREATE_TASK_URL=https://bot-dev.stable.popstas.ru/agent/planfix/tool/planfix_create_task
   PORT=3012
   NODE_ENV=development
   CONFIG=data/config.yml
   ```

## Running the Application

### Development

Run the ingest service with hot reload using `tsx`:

```bash
npm run dev
```

The ingest server will start on `http://localhost:3012`.

### Production

Run the queue worker and the ingest service separately using `tsx`:

```bash
npm start        # start the worker
npm run ingest   # start the webhook collector (queue processing disabled)

When running `npm run ingest` the service only stores incoming webhooks.
Run the worker separately to process the queue.
```

## Docker

### Build the Docker image

```bash
docker build -t amocrm-to-planfix .
```

### Docker Compose

To run the ingest service, worker and monitoring stack use docker-compose:

```bash
docker compose up -d
```

Grafana will be available on `http://localhost:3000` and Loki on port `3100`.

## Webhook Configuration in AMOCRM

1. Go to AMOCRM settings
2. Navigate to Webhooks
3. Add a new webhook with the following settings:
   - URL: path from your `config.yml` (for example `http://localhost:3012/amocrm`)
   - Events: Select "Lead added"
   - HTTP Method: POST
   - Content Type: application/x-www-form-urlencoded

## API Endpoints

- `GET /` - Health check endpoint
 - Webhook endpoints defined in `config.yml`

## Testing Webhooks

Use `npm run test-webhook` to process a sample webhook. By default it loads data from `./data/body-test.json`.
To specify another file, pass the path as an argument:

```bash
npm run test-webhook -- <path-to-json>
```

## Configuration

The application reads settings from `config.yml`. Override the location with the `CONFIG` environment variable.
Each webhook entry may specify optional `tags`, `pipeline`, `project` and `leadSource` values which will be added to created tasks if they are not already set.
Example:

```yml
webhooks:
  - name: amocrm
    webhook_path: /amocrm
    tags: [sales]
    pipeline: Sales
    project: Website
    leadSource: AMOCRM
queue:
  max_attempts: 12
  start_delay: 1000
target:
  token: your_planfix_token
  url: https://planfix.example.com
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Port to run the server on (default: 3012) |
| `NODE_ENV` | No | Node environment (development/production) |
| `AMOCRM_TOKEN` | Yes | AMOCRM OAuth access token |
| `AGENT_TOKEN` | Yes* | Planfix agent token |
| `CREATE_TASK_URL` | Yes* | Planfix task creation endpoint |
| `CONFIG` | No | Path to `config.yml` (default: `data/config.yml`) |
| `PROXY_URL` | No | Proxy URL for AMOCRM requests |

`*` Required if not provided in `config.yml` under `target`.

## License

ISC
