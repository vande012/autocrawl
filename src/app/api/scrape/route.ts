// src/app/api/scrape/route.ts
import axios from 'axios';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';

interface UrlStatus {
  url: string;
  statusCode: number | string;
}

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';
const CONCURRENT_REQUESTS = 10;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_URLS = 10000; // Limit the number of URLs to check

const limit = pLimit(CONCURRENT_REQUESTS);


function isValidUrl(url: string, baseUrl: string): boolean {
  const disallowedExtensions = ['.php', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf'];
  
  try {
    const parsedUrl = new URL(url, baseUrl);
    
    // Ensure it's on the same domain
    if (parsedUrl.origin !== new URL(baseUrl).origin) {
      return false;
    }

    // Strip fragment and query string
    parsedUrl.hash = '';
    parsedUrl.search = '';

    // Check if the URL has a disallowed file extension
    const path = parsedUrl.pathname;
    if (disallowedExtensions.some(ext => path.endsWith(ext))) {
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error parsing URL: ${url}`, error);
    return false;
  }
}

async function checkUrlStatus(url: string): Promise<UrlStatus> {
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 0,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
      },
      validateStatus: function (status) {
        return status >= 200 && status < 600;
      },
    });
    return { url, statusCode: response.status };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return { url, statusCode: error.response.status };
    }
    return { url, statusCode: 'Error' };
  }
}

function stripFragmentAndQuery(url: string): string {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = ''; // Remove the fragment (anything after #)
    parsedUrl.search = ''; // Optionally remove the query string as well
    return parsedUrl.toString();
  } catch (error) {
    console.error(`Error parsing URL: ${url}`, error);
    return url;
  }
}

async function crawlAndCheck(
  baseUrl: string,
  urlsToCheck: string[],
  processedUrls: Set<string>,
  writeToStream: (data: string) => Promise<void>,
  maxDepth: number = 2
) {
  const queue: { url: string; depth: number }[] = urlsToCheck.map((url) => ({ url: stripFragmentAndQuery(url), depth: 0 }));
  let checkedCount = 0;
  let queuedCount = queue.length;

  while (queue.length > 0 && processedUrls.size < MAX_URLS) {
    const batch = queue.splice(0, CONCURRENT_REQUESTS);
    const results = await Promise.all(
      batch.map(({ url, depth }) =>
        limit(async () => {
          const strippedUrl = stripFragmentAndQuery(url);
          if (processedUrls.has(strippedUrl)) return null;
          processedUrls.add(strippedUrl);

          if (!isValidUrl(strippedUrl, baseUrl)) {
            console.log(`Skipping invalid URL: ${strippedUrl}`);
            return null;
          }

          const status = await checkUrlStatus(url);
          checkedCount++;
          await writeToStream(
            JSON.stringify({
              urlStatus: status,
              progress: {
                checked: checkedCount,
                total: processedUrls.size,
                queued: queue.length,
                percentage: ((checkedCount / (checkedCount + queue.length)) * 100).toFixed(2),
              },
            })
          );

          // Only crawl links if we haven't reached the maximum depth
          if (status.statusCode === 200 && depth < maxDepth) {
            try {
              const response = await axios.get(url, {
                timeout: REQUEST_TIMEOUT,
                headers: { 'User-Agent': DEFAULT_USER_AGENT },
              });
              const $ = cheerio.load(response.data);
              const links = $('a')
                .map((i, el) => $(el).attr('href'))
                .get();
              for (const link of links) {
                if (link) {
                  try {
                    const fullUrl = new URL(link, baseUrl).href;
                    const strippedFullUrl = stripFragmentAndQuery(fullUrl);

                    if (isValidUrl(strippedFullUrl, baseUrl) && !processedUrls.has(strippedFullUrl)) {
                      queue.push({ url: strippedFullUrl, depth: depth + 1 });
                      queuedCount++;
                    }
                  } catch (e) {
                    console.error(`Invalid URL: ${link}`);
                  }
                }
              }
            } catch (error) {
              console.error(`Error crawling ${url}:`, error);
            }
          }
          return status;
        })
      )
    );
  }

  // Final progress report
  await writeToStream(
    JSON.stringify({
      progress: {
        checked: checkedCount,
        total: processedUrls.size,
        queued: queue.length,
        percentage: ((checkedCount / (checkedCount + queue.length)) * 100).toFixed(2),
      },
    })
  );
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

      const processedUrls = new Set<string>();

      // Start crawling from the provided URL
      await writeToStream(JSON.stringify({ status: 'Crawling and checking URLs' }));
      await crawlAndCheck(url, [url], processedUrls, writeToStream);

      await writeToStream(JSON.stringify({ status: 'Completed' }));
    } catch (error: unknown) {
      console.error('Error:', error);
      let errorMessage = 'An error occurred while fetching data';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage += `: ${error}`;
      }
      await writeToStream(JSON.stringify({ error: errorMessage }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
