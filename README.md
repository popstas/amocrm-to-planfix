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
For the `amocrm` webhook you can additionally define `projectByTags` and `projectByPipelines` to map specific tags or pipeline names to Planfix projects. Matching is case‑insensitive and treats similar‑looking Latin and Cyrillic letters as the same.
For Tilda webhooks you can also define `tagsByTitle` to add tags when the form title contains a configured keyword, and `projectByUtmSource` to map UTM sources to Planfix projects.

Example:

```yml
webhooks:
  - name: amocrm
    webhook_path: /amocrm
    tags: [sales]
    pipeline: Sales
    project: Website
    leadSource: AMOCRM
    projectByTags:
      tag1: project1
      other_project: other project
    projectByPipelines:
      Sales: Website Sales
      Support: Support Project
  - name: tilda
    webhook_path: /tilda
    tags: [landing]
    pipeline: Web
    project: Website
    leadSource: Tilda
    projectByUtmSource:
      blog: Blog Project
    tagsByTitle:
      "Прямой эфир": "Рег"
queue:
  max_attempts: 12
  start_delay: 1000
planfix_agent:
  token: your_planfix_token
  url: https://planfix.example.com
telegram:
  bot_name: example_bot
  bot_token: token
  chat_id: 123456
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Port to run the server on (default: 3012) |
| `NODE_ENV` | No | Node environment (development/production) |
| `CONFIG` | No | Path to `config.yml` (default: `data/config.yml`) |

## License

ISC
