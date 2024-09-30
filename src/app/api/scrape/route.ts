// File: src/app/api/scrape/route.ts

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';

export async function POST(request: NextRequest) {
  const { url, checkAltText, searchTerm } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initialize the crawler
        const crawler = new Crawler(url, checkAltText, searchTerm);
        
        // Start crawling
        await crawler.crawl((data) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'Completed' })}\n\n`));
      } catch (error) {
        console.error('Crawling error:', error);
        let errorMessage = 'An error occurred while crawling';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
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

class Crawler {
  private baseUrl: string;
  private checkAltText: boolean;
  private searchTerm: string;
  private visited: Set<string> = new Set();
  private total: number = 0;
  private checked: number = 0;

  constructor(baseUrl: string, checkAltText: boolean, searchTerm: string) {
    this.baseUrl = baseUrl;
    this.checkAltText = checkAltText;
    this.searchTerm = searchTerm;
  }

  async crawl(sendUpdate: (data: any) => void) {
    this.total = 1; // Start with at least one URL (the base URL)
    await this.crawlPage(this.baseUrl, sendUpdate);
  }

  private isValidUrl(url: string): boolean {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    
    // Exclude specific patterns
    if (
      url.includes('#') ||
      path.startsWith('/inventory') ||
      path.endsWith('.php') ||
      path.endsWith('.css') ||
      path.endsWith('.js') ||
      parsedUrl.search !== ''  // Excludes query strings
    ) {
      return false;
    }
    
    return parsedUrl.origin === new URL(this.baseUrl).origin;
  }

  private async crawlPage(url: string, sendUpdate: (data: any) => void) {
    if (this.visited.has(url)) return;
    this.visited.add(url);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        }
      });
      const $ = cheerio.load(response.data);

      const urlStatus: any = {
        url,
        statusCode: response.status,
        origin: new URL(url).origin,
      };

      if (this.checkAltText) {
        const imagesWithMissingAlt = $('img:not([alt])').map((_, el) => $(el).attr('src')).get();
        urlStatus.altTextMissing = imagesWithMissingAlt.length > 0;
        urlStatus.imagesWithMissingAlt = imagesWithMissingAlt;
      }

      if (this.searchTerm) {
        urlStatus.containsSearchTerm = response.data.includes(this.searchTerm);
      }

      sendUpdate({ urlStatus });

      // Find all links on the page
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const newUrl = new URL(href, url).href;
            if (this.isValidUrl(newUrl) && !this.visited.has(newUrl)) {
              this.crawlPage(newUrl, sendUpdate);
            }
          } catch (error) {
            console.error(`Invalid URL: ${href}`);
          }
        }
      });
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      let statusCode: number | string = 'Error';
      let errorMessage = 'An unknown error occurred';
      
      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status || 'Error';
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.checked++;
      sendUpdate({
        urlStatus: {
          url,
          statusCode,
          origin: new URL(url).origin,
          error: errorMessage
        },
        progress: {
          checked: this.checked,
          total: this.total,
          queued: this.total - this.checked
        }
      });
    }
  }
}