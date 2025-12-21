from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from langchain_community.document_loaders import WebBaseLoader
from pydantic import BaseModel
from typing import Optional
import os

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    url: str

class ScrapeResponse(BaseModel):
    success: bool
    url: str
    content: Optional[str] = None
    error: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Website Scraper Service", "status": "running"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(request: ScrapeRequest):
    """Scrapes a URL and returns the content."""
    try:
        # Validate URL
        if not request.url or not request.url.startswith(('http://', 'https://')):
            return ScrapeResponse(
                success=False,
                url=request.url,
                error="Invalid URL format. Must start with http:// or https://"
            )
        
        # Load and scrape the webpage
        loader = WebBaseLoader(request.url)
        docs = await run_in_threadpool(loader.load)
        
        if not docs or len(docs) == 0:
            return ScrapeResponse(
                success=False,
                url=request.url,
                error="No content found on the page"
            )
        
        # Extract and clean content (limit to reasonable size for LLM context)
        content = docs[0].page_content.strip()
        
        # Limit content size (e.g., 10k characters)
        max_length = 10000
        if len(content) > max_length:
            content = content[:max_length] + "... [content truncated]"
        
        return ScrapeResponse(
            success=True,
            url=request.url,
            content=content
        )
    except Exception as e:
        error_msg = str(e)
        print(f"[Scraper] Error scraping {request.url}: {error_msg}")
        return ScrapeResponse(
            success=False,
            url=request.url,
            error=error_msg
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)

