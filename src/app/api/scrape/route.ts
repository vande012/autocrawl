import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { RobotsTxt } from 'robots-txt-parse';

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';
const CONCURRENT_REQUESTS = 10;
const MAX_DEPTH = 5;


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
        // Move isStreamClosed to the stream context
        (this as any).isStreamClosed = true; // Mark the stream as closed
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

interface QueueItem {
  url: string;
  depth: number;
  referrer?: string; // Add referrer to track where the link was found
}

class Crawler {
  private baseUrl: string;
  private checkAltText: boolean;
  private searchTerm: string;
  private visited: Set<string> = new Set();
  private urlsFound: number = 0;
  private urlsProcessed: number = 0;
  private limit: ReturnType<typeof pLimit>;
  private queue: QueueItem[] = [];
  private robotsTxt: any;
  private updateBuffer: UpdateData[] = [];
  private maxRetries: number = 3; // Maximum number of retries for 500 errors
  private retryDelay: number = 2000; // Delay in milliseconds before retrying
  private isStreamClosed: boolean = false; // Declare isStreamClosed

  constructor(baseUrl: string, checkAltText: boolean, searchTerm: string) {
    this.baseUrl = baseUrl;
    this.checkAltText = checkAltText;
    this.searchTerm = searchTerm;
    this.limit = pLimit(CONCURRENT_REQUESTS);
  }

  // Add this method to the Crawler class
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchRobotsTxt(): Promise<void> {
    try {
      const robotsTxtUrl = new URL('/robots.txt', this.baseUrl).href;
      const response = await axios.get(robotsTxtUrl);
      const robotsTxt = new RobotsTxt(response.data);
      this.robotsTxt = robotsTxt;
    } catch (error) {
      console.error('Error fetching robots.txt:', error);
      this.robotsTxt = null;
    }
  }
  
  private isAllowedByRobotsTxt(url: string): boolean {
    if (!this.robotsTxt) return true;
    return this.robotsTxt.isAllowed(DEFAULT_USER_AGENT, url);
  }

  private normalizeUrl(url: string): string {
    const parsedUrl = new URL(url);
    parsedUrl.hash = '';
    parsedUrl.search = '';
    return parsedUrl.href;
  }

  private isValidUrl(url: string): boolean {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    
    if (
      url.includes('#') || 
      path.startsWith('/inventory') ||
      path.endsWith('.php') ||
      path.endsWith('.css') ||
      path.endsWith('.js')
    ) {
      return false;
    }
    
    return parsedUrl.origin === new URL(this.baseUrl).origin && this.isAllowedByRobotsTxt(url);
  }

  private async crawlPage(item: QueueItem, sendUpdate: SendUpdate): Promise<void> {
    const { url, depth, referrer } = item;
    const normalizedUrl = this.normalizeUrl(url);
    if (this.visited.has(normalizedUrl) || depth > MAX_DEPTH) return;
    this.visited.add(normalizedUrl);

    let attempts = 0;

    while (attempts < this.maxRetries) {
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
          // Ensure origin is always a string
          origin: response.status < 300 ? '' : (referrer || 'Direct Access'), 
        };

        if (response.status >= 300 && response.status < 400) {
          urlStatus.redirectUrl = response.headers.location;
        } else if (response.status === 200) {
          const $ = cheerio.load(response.data);

  
          if (this.checkAltText) {
            const imagesWithoutAlt = $('img').filter((_, el) => {
              const alt = $(el).attr('alt');
              return typeof alt === 'undefined' || alt.trim() === '';
            }).map((_, el) => {
              const src = $(el).attr('src');
              return src ? new URL(src, url).href : null;
            }).get().filter(Boolean);
  
            if (imagesWithoutAlt.length > 0) {
              urlStatus.imagesWithoutAlt = imagesWithoutAlt;
            }
          }
  
          if (this.searchTerm) {
            urlStatus.containsSearchTerm = response.data.includes(this.searchTerm);
          }
  
          if (depth < MAX_DEPTH) {
            $('a').each((_, element) => {
              const href = $(element).attr('href');
              if (href) {
                try {
                  const newUrl = new URL(href, url).href;
                  if (this.isValidUrl(newUrl) && !this.visited.has(this.normalizeUrl(newUrl))) {
                    this.urlsFound++;
                    this.queue.push({ 
                      url: newUrl, 
                      depth: depth + 1,
                      referrer: url // Set current URL as referrer for the new URL
                    });
                  }
                } catch (error) {
                  console.error(`Invalid URL: ${href}`);
                }
              }
            });
          }
        }

        this.urlsProcessed++;
        this.updateBuffer.push({ 
          urlStatus,
          progress: {
            urlsFound: this.urlsFound,
            urlsProcessed: this.urlsProcessed
          }
        });

        return;

      } catch (error) {
        const statusCode = (error as AxiosError).response?.status || 0;

        if (statusCode >= 400) {
          // Create a new UrlStatus for the broken link
          const brokenLinkStatus: UrlStatus = {
            url,
            statusCode,
            origin: referrer || 'Direct Access', // Use referrer as origin for broken links
            error: (error as Error).message,
          };

          this.urlsProcessed++;
          this.updateBuffer.push({ 
            urlStatus: brokenLinkStatus,
            progress: {
              urlsFound: this.urlsFound,
              urlsProcessed: this.urlsProcessed
            }
          });

          if (statusCode < 500) return;
        }

        if (statusCode >= 500) {
          attempts++;
          if (attempts < this.maxRetries) {
            await this.delay(this.retryDelay);
            continue;
          }
        }

        return;
      }
    }
  }

  async crawl(sendUpdate: SendUpdate): Promise<void> {
    await this.fetchRobotsTxt();
    this.urlsFound = 1;
    // Start with no referrer for the initial URL
    this.queue.push({ url: this.baseUrl, depth: 0, referrer: undefined });

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, CONCURRENT_REQUESTS);
      const promises = batch.map(item => this.limit(() => this.crawlPage(item, sendUpdate)));
      await Promise.all(promises);
      this.flushUpdateBuffer(sendUpdate);
    }

    this.flushUpdateBuffer(sendUpdate);
    sendUpdate({ status: 'Completed' });
  }

  // Add this method to the Crawler class
  private flushUpdateBuffer(sendUpdate: SendUpdate): void {
    if (this.isStreamClosed) return; // Prevent further updates if the stream is closed
    while (this.updateBuffer.length > 0) {
      const update = this.updateBuffer.shift();
      if (update) {
        sendUpdate(update);
      }
    }
  }
}
