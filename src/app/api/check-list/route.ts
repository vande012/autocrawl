import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const DEFAULT_USER_AGENT = 'LLw7Ra4T5fuF';

export async function POST(request: NextRequest) {
  const { urls } = await request.json();

  if (!urls || !Array.isArray(urls)) {
    return NextResponse.json({ error: 'URLs array is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const url of urls) {
          try {
            const response = await axios.get(url, {
              headers: {
                'User-Agent': DEFAULT_USER_AGENT
              }
            });

            const result = {
              url,
              statusCode: response.status,
              origin: new URL(url).origin,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ urlStatus: result })}\n\n`));
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

            const result = {
              url,
              statusCode,
              origin: new URL(url).origin,
              error: errorMessage
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ urlStatus: result })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'Completed' })}\n\n`));
      } catch (error) {
        console.error('Error processing URLs:', error);
        let errorMessage = 'An error occurred while processing URLs';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
      } finally {
        controller.close();
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