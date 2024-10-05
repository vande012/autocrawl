# Autocrawl
Autocrawl is a web crawler that checks the status of URLs on a domain. It streams the results in real-time and supports depth-limited crawling and concurrency management. Follow the steps below to install and run the app locally or using Docker.

## Getting Started
You can run Autocrawl either using Docker or locally. Choose the method that best suits your needs.

### Option 1: Running with Docker
1. Pull the Docker image:
    ```bash
    docker pull vande012/autocrawl:latest
    ```

2. Run the container:
    ```bash
    docker run -p 3000:3000 vande012/autocrawl:latest
    ```

3. Open your browser and go to `http://localhost:3000` to use the app.

### Option 2: Running Locally
To install and run the app locally on Mac or PC, follow these steps:

#### Prerequisites
Ensure you have the following installed:
- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js) or an alternative package manager like `yarn`, `pnpm`, or `bun`
- **Git**

#### Installation Steps
1. Clone the repository: Open a terminal (Mac/Linux) or command prompt (Windows), and clone the repository:
    ```bash
    git clone https://github.com/vande012/autocrawl.git
    ```

2. Navigate into the project directory:
    ```bash
    cd autocrawl
    ```

3. Install dependencies using your preferred package manager:
    ```bash
    npm install
    ```
    Or if using an alternative package manager:
    ```bash
    yarn install
    ```
    ```bash
    pnpm install
    ```
    ```bash
    bun install
    ```

4. Run the development server:
    ```bash
    npm run dev
    ```
    Or with an alternative package manager:
    ```bash
    yarn dev
    ```
    ```bash
    pnpm dev
    ```
    ```bash
    bun dev
    ```

5. Open the app in your browser: Once the server is running, open your browser and go to:
    ```
    http://localhost:3000
    ```

You should now see your app running!

## Start Editing
You can begin editing the app by modifying the file `app/page.tsx`. The changes will auto-update as you save.

## Learn More
To learn more about Next.js, take a look at the following resources:
- [Next.js Documentation](https://nextjs.org/docs) – learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) – an interactive Next.js tutorial.

# Updating and Running Your Docker Image

1. **Save and Commit Changes**: 
   Ensure all your code changes are saved and committed to your project.

2. **Navigate to Project Directory**:
   Open a terminal and cd to your project's root directory.

3. **Build New Docker Image**:
   ```bash
   docker build -t vande012/autocrawl:latest .
   ```
   This builds a new image tagged as 'latest'.

4. **Push to Docker Hub** (optional, but recommended for distribution):
   ```bash
   docker push vande012/autocrawl:latest
   ```

5. **Run New Container**:
   ```bash
   docker run -p 3000:3000 vande012/autocrawl:latest
   ```
   This runs a container from your new image, mapping port 3000.

6. **Verify**: 
   Open a web browser and go to `http://localhost:3000` to check if your app is running with the updates.

7. **Cleanup** (optional):
   To remove old containers and images:
   ```bash
   docker container prune  # Removes stopped containers
   docker image prune      # Removes unused images
   ```



Remember to update the README or documentation if there are any changes in functionality or usage.

# route.ts Documentation

## Overview

This file implements a web crawler using Next.js API routes. It provides a streaming API endpoint that crawls web pages, checks their status, and optionally looks for missing alt text on images or searches for specific terms.

## Key Components

### POST Handler

- Accepts parameters: `url`, `checkAltText`, and `searchTerm`
- Creates a `ReadableStream` to stream results back to the client
- Utilizes the `Crawler` class to perform the crawling operation

### Crawler Class

The heart of the crawling functionality, responsible for:

- Fetching and parsing robots.txt
- Managing a queue of URLs to crawl
- Concurrent crawling of pages
- Checking page status, alt text, and search terms
- Sending updates on crawl progress

## Key Features

1. **Streaming Results**: Uses `ReadableStream` to send results in real-time.
2. **Concurrent Requests**: Utilizes `pLimit` to manage concurrent requests (default: 10).
3. **Depth-Limited Crawling**: Implements a maximum depth (default: 5) to prevent infinite crawling.
4. **Robots.txt Compliance**: Fetches and respects robots.txt rules.
5. **URL Normalization**: Normalizes URLs to prevent duplicate crawling.
6. **Batched Updates**: Buffers updates and sends them in batches to reduce overhead.

## Performance Considerations

### Server Requests

- **Concurrent Requests**: Managed by `pLimit`, set to 10 by default. Adjust `CONCURRENT_REQUESTS` based on server capacity.
- **Robots.txt Compliance**: Helps avoid overloading servers and respects site owners' wishes.

### Speed Optimizations

- **URL Filtering**: Implements `isValidUrl` to quickly filter out unnecessary URLs.
- **Depth Limiting**: Prevents excessive crawling with `MAX_DEPTH`.
- **Batched Updates**: Reduces the number of messages sent to the client.
- **URL Normalization**: Prevents recrawling of the same page with slight URL differences.


## Configuration

Key constants that can be adjusted:

- `DEFAULT_USER_AGENT`: The user agent string used for requests.
- `CONCURRENT_REQUESTS`: Number of concurrent requests allowed.
- `MAX_DEPTH`: Maximum depth for crawling.
- `BATCH_SIZE`: Number of updates to buffer before sending.

