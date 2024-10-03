import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';
const CONCURRENT_REQUESTS = 5;

type SendUpdate = (data: UpdateData) => void;

interface UrlStatus {
  url: string;
  statusCode: number;
  origin: string;
  imagesWithoutAlt?: string[];
  containsSearchTerm?: boolean;
  error?: string;
  redirectUrl?: string;
}

type UpdateData = {
  urlStatus: UrlStatus;
  progress: {
    urlsFound: number;
    urlsProcessed: number;
  };
} | {
  status: 'Completed';
};

// Crawler class (from your api/scrape/route.ts)
class Crawler {
  private baseUrl: string;
  private checkAltText: boolean;
  private searchTerm: string;
  private visited: Set<string> = new Set();
  private urlsFound: number = 0;
  private urlsProcessed: number = 0;
  private limit: ReturnType<typeof pLimit>;
  private queue: string[] = [];

  constructor(baseUrl: string, checkAltText: boolean, searchTerm: string) {
    this.baseUrl = baseUrl;
    this.checkAltText = checkAltText;
    this.searchTerm = searchTerm;
    this.limit = pLimit(CONCURRENT_REQUESTS);
  }

  async crawl(sendUpdate: (data: UpdateData) => void): Promise<void> {
    this.urlsFound = 1;
    this.queue.push(this.baseUrl);

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, CONCURRENT_REQUESTS);
      const promises = batch.map(url => this.limit(() => this.crawlPage(url, sendUpdate)));
      await Promise.all(promises);
    }

    sendUpdate({ status: 'Completed' });
  }

  private isValidUrl(url: string): boolean {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    
    if (
      url.includes('#') ||
      path.startsWith('/inventory') ||
      path.endsWith('.php') ||
      path.endsWith('.css') ||
      path.endsWith('.js') ||
      parsedUrl.search !== ''
    ) {
      return false;
    }
    
    return parsedUrl.origin === new URL(this.baseUrl).origin;
  }

  private async crawlPage(url: string, sendUpdate: SendUpdate): Promise<void> {
    if (this.visited.has(url)) return;
    this.visited.add(url);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 600;
        },
      });

      const urlStatus: UrlStatus = {
        url,
        statusCode: response.status,
        origin: new URL(url).origin,
      };

      if (response.status >= 300 && response.status < 400) {
        urlStatus.redirectUrl = response.headers.location;
      } else if (response.status === 200) {
        const $ = cheerio.load(response.data);

        if (this.checkAltText) {
          const imagesWithoutAlt = $('img').filter((_, el) => {
            const $el = $(el);
            const alt = $el.attr('alt');
            // Check if alt attribute is missing or empty (ignoring whitespace)
            return typeof alt === 'undefined' || alt.trim() === '';
          }).map((_, el) => {
            const src = $(el).attr('src');
            if (src && src.trim() !== '') {
              try {
                // Convert relative URLs to absolute URLs
                return new URL(src, url).href;
              } catch (error) {
                console.error(`Invalid image URL: ${src}`);
                return null;
              }
            }
            return null;
          }).get().filter(Boolean);
          
          if (imagesWithoutAlt.length > 0) {
            urlStatus.imagesWithoutAlt = imagesWithoutAlt;
          }
        }

        if (this.searchTerm) {
          urlStatus.containsSearchTerm = response.data.includes(this.searchTerm);
        }

        $('a').each((_, element) => {
          const href = $(element).attr('href');
          if (href) {
            try {
              const newUrl = new URL(href, url).href;
              if (this.isValidUrl(newUrl) && !this.visited.has(newUrl)) {
                this.urlsFound++;
                this.queue.push(newUrl);
              }
            } catch (error) {
              console.error(`Invalid URL: ${href}`);
            }
          }
        });
      }

      this.urlsProcessed++;
      sendUpdate({ 
        urlStatus,
        progress: {
          urlsFound: this.urlsFound,
          urlsProcessed: this.urlsProcessed
        }
      });
    } catch (error) {
      
    }
  }
}
const handleScrape = async (body: any): Promise<APIGatewayProxyResult> => {
  const { url, checkAltText, searchTerm } = body;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL is required' }),
    };
  }

  const crawler = new Crawler(url, checkAltText, searchTerm);
  const results: UpdateData[] = [];

  await crawler.crawl((data: UpdateData) => {
    results.push(data);
  });

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};

const handleCheckList = async (body: any): Promise<APIGatewayProxyResult> => {
  const { urls } = body;

  if (!urls || !Array.isArray(urls)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URLs array is required' }),
    };
  }

  const results = await Promise.all(urls.map(async (url) => {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        }
      });

      return {
        url,
        statusCode: response.status,
        origin: new URL(url).origin,
      };
    } catch (error) {
      console.error(`Error checking ${url}:`, error);
      let statusCode = 'Error';
      let errorMessage = 'An unknown error occurred';
      
      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status?.toString() || 'Error';
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        url,
        statusCode,
        origin: new URL(url).origin,
        error: errorMessage
      };
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const path = event.path;

    if (path.endsWith('/scrape')) {
      return await handleScrape(body);
    } else if (path.endsWith('/check-list')) {
      return await handleCheckList(body);
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found' }),
      };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};