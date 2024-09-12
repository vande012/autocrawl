## Getting Started

Getting Started
To install and run the app locally on Mac and PC, follow these steps:

Prerequisites:
Ensure you have the following installed:

Node.js (version 14 or higher)
npm (comes with Node.js) or an alternative package manager like yarn, pnpm, or bun.
Git

Installation Steps:
Clone the repository: Open a terminal (Mac/Linux) or command prompt (Windows), and clone the repository:

bash
git clone https://github.com/vande012/autocrawl.git

Navigate into the project directory:

bash
cd autocrawl

Install dependencies: You can install the project dependencies using your preferred package manager:

For npm:
bash
npm install

For yarn:
bash
yarn install

For pnpm:
bash
pnpm install

For bun:
bash
bun install

Run the development server: Start the server using the appropriate command based on your package manager:

For npm:
bash
npm run dev

For yarn:
bash
yarn dev

For pnpm:
bash
pnpm dev

For bun:
bash
bun dev

Open the app in your browser: Once the server is running, open your browser and go to:

http://localhost:3000

You should see your app running!

Start Editing: You can begin editing the app by modifying the file app/page.tsx. The changes will auto-update as you save.
## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.


## Overview of route.ts

Imports and Interfaces:
The code starts by importing necessary libraries and defining an interface for the UrlStatus object.
Constants:
Several constants are defined, including the user agent, concurrent request limit, timeout, and maximum number of URLs to check.
Helper Functions:

isValidUrl: Checks if a URL is valid based on certain criteria (same domain, allowed file extensions).
stripFragmentAndQuery: Removes fragments and query strings from URLs.
checkUrlStatus: Performs an HTTP request to check the status of a given URL.


Main Crawling Function (crawlAndCheck):
This is the core function that performs the web crawling and URL checking. Here's how it works:
a. It initializes a queue with the starting URL.
b. It processes URLs from the queue in batches, using pLimit to limit concurrent requests.
c. For each URL:

It checks if the URL has been processed before.
It validates the URL.
It checks the URL's status using checkUrlStatus.
It writes the status and progress to the stream.
If the URL is valid and the depth limit hasn't been reached, it crawls the page for more links and adds them to the queue.


POST Request Handler:
This is the main function that handles the incoming POST request:
a. It sets up a TransformStream for writing data.
b. It extracts the URL from the request body.
c. It calls crawlAndCheck with the provided URL.
d. It streams the results back to the client as they become available.
e. It handles errors and closes the stream when finished.

The key aspects of this implementation are:

Streaming: Instead of waiting for all URLs to be checked before sending a response, it streams results back to the client in real-time.
Concurrency: It uses pLimit to limit the number of concurrent requests, preventing overwhelming the target server.
Depth-limited crawling: It crawls links found on pages up to a certain depth, allowing for more comprehensive checking.
Error handling: It catches and reports errors, both for individual URL checks and for the overall process.
Progress reporting: It provides regular updates on the progress of the crawl.
