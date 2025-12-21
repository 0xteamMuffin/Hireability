# Website Scraper Service

FastAPI service for scraping company websites to provide context for interviews.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the service:
```bash
python main.py
```

Or with Docker:
```bash
docker-compose up
```

## Environment Variables

- `PORT`: Port to run the service on (default: 8001)

## API Endpoints

### POST /scrape

Scrapes a website URL and returns the content.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com",
  "content": "Scraped website content..."
}
```

## Integration

The Node.js backend calls this service via HTTP. Set the `SCRAPER_SERVICE_URL` environment variable in your backend `.env`:

```
SCRAPER_SERVICE_URL=http://localhost:8001
```

