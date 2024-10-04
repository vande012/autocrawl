import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';
const CONCURRENT_REQUESTS = 10;

export async function POST(request: NextRequest) {
  const { url, checkAltText, searchTerm } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const crawler = new Crawler(url, checkAltText, searchTerm);
      
      try {
        await crawler.crawl((data) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (error) {
            console.error('Error enqueueing data:', error);
          }
        });
      } catch (error) {
        console.error('Crawling error:', error);
        let errorMessage = 'An error occurred while crawling';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        } catch (enqueueError) {
          console.error('Error enqueueing error message:', enqueueError);
        }
      } finally {
        try {
          controller.close();
        } catch (closeError) {
          console.error('Error closing controller:', closeError);
        }
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

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

type SendUpdate = (data: UpdateData) => void;

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

  async crawl(sendUpdate: SendUpdate): Promise<void> {
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