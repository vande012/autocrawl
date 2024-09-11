// src/app/api/scrape/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

interface UrlStatus {
  url: string;
  statusCode: number | string;
}

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';

async function fetchXml(url: string): Promise<any> {
  console.log('Fetching XML from:', url);
  const response = await axios.get(url, { 
    timeout: 10000,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT
    }
  });
  const parser = new XMLParser();
  return parser.parse(response.data);
}

async function processSitemap(sitemapUrl: string, processedUrls: Set<string>): Promise<string[]> {
  if (processedUrls.has(sitemapUrl)) {
    return [];
  }
  processedUrls.add(sitemapUrl);

  const result = await fetchXml(sitemapUrl);
  let urls: string[] = [];

  if (result.sitemapindex) {
    // This is a sitemap index
    const sitemaps = result.sitemapindex.sitemap;
    if (Array.isArray(sitemaps)) {
      for (const sitemap of sitemaps) {
        urls = urls.concat(await processSitemap(sitemap.loc, processedUrls));
      }
    } else if (sitemaps?.loc) {
      urls = urls.concat(await processSitemap(sitemaps.loc, processedUrls));
    }
  } else if (result.urlset) {
    // This is a regular sitemap
    const sitemapUrls = result.urlset.url;
    if (Array.isArray(sitemapUrls)) {
      urls = sitemapUrls.map((item: any) => item.loc);
    } else if (sitemapUrls?.loc) {
      urls.push(sitemapUrls.loc);
    }
  }

  console.log(`Found ${urls.length} URLs in sitemap:`, sitemapUrl);
  return urls;
}

async function checkUrlStatus(url: string): Promise<UrlStatus> {
  const maxRetries = 2;
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status < 600; // Resolve for status codes less than 600
        },
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        }
      });
      return { url, statusCode: response.status };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          return { url, statusCode: error.response.status };
        } else if (error.code === 'ECONNABORTED') {
          console.log(`Timeout for URL: ${url}. Retrying...`);
        } else {
          console.log(`Network error for URL: ${url}. Error: ${error.message}. Retrying...`);
        }
      } else {
        console.log(`Unknown error for URL: ${url}. Retrying...`);
      }
      retries++;
      if (retries > maxRetries) {
        return { url, statusCode: 'Error' };
      }
      // Wait for a short time before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return { url, statusCode: 'Error' };
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const writeToStream = async (data: string) => {
    await writer.write(encoder.encode(data + '\n'));
  };

  (async () => {
    try {
      const { url } = await request.json();
      console.log('Received URL:', url);
      
      if (!url) {
        await writeToStream(JSON.stringify({ error: 'URL is required' }));
        return;
      }

      const sitemapIndexUrl = new URL('/sitemap_index.xml', url).href;
      const processedUrls = new Set<string>();
      const allUrls = await processSitemap(sitemapIndexUrl, processedUrls);

      console.log('Total URLs found:', allUrls.length);
      await writeToStream(JSON.stringify({ totalUrls: allUrls.length }));

      for (const url of allUrls) {
        const status = await checkUrlStatus(url);
        await writeToStream(JSON.stringify({ urlStatus: status }));
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
      }

      console.log('Processed all URLs');
    } catch (error) {
      console.error('Error:', error);
      await writeToStream(JSON.stringify({ error: 'An error occurred while fetching data' }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}