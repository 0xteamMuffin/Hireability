import axios from 'axios';

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:8001';

export interface ScrapeResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ScrapeResponse {
  success: boolean;
  url: string;
  content?: string;
  error?: string;
}

/**
 * Scrape a website URL using the FastAPI scraper service
 */
export const scrapeWebsite = async (url: string): Promise<ScrapeResult> => {
  try {
    if (!url || !url.startsWith('http')) {
      return {
        success: false,
        error: 'Invalid URL format',
      };
    }

    const response = await axios.post<ScrapeResponse>(
      `${SCRAPER_SERVICE_URL}/scrape`,
      { url },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.data.success && response.data.content) {
      return {
        success: true,
        content: response.data.content,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Failed to scrape website',
    };
  } catch (error) {
    console.error('[scraper.service] Error calling scraper service:', error);

    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Network error',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

