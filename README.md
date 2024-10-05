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

## Overview of `route.ts`

The core of the app's crawling functionality is handled in the `route.ts` file. Here's a breakdown:

### Imports and Interfaces

The code starts by importing necessary libraries and defining an interface for the `UrlStatus` object.

### Constants

Several constants are defined, including:
- User agent
- Concurrent request limit
- Timeout duration
- Maximum number of URLs to check

### Helper Functions

- **`isValidUrl`**: Checks if a URL is valid based on certain criteria (same domain, allowed file extensions).
- **`stripFragmentAndQuery`**: Removes fragments and query strings from URLs.
- **`checkUrlStatus`**: Performs an HTTP request to check the status of a given URL.

### Main Crawling Function (`crawlAndCheck`)

This is the core function that performs the web crawling and URL checking. Here's how it works:

1. Initializes a queue with the starting URL.
2. Processes URLs from the queue in batches, using `pLimit` to limit concurrent requests.
3. For each URL:
    - Checks if the URL has been processed before.
    - Validates the URL.
    - Checks the URL's status using `checkUrlStatus`.
    - Writes the status and progress to the stream.
    - If the URL is valid and the depth limit hasn't been reached, it crawls the page for more links and adds them to the queue.

### POST Request Handler

This function handles the incoming POST request:

1. Sets up a `TransformStream` for writing data.
2. Extracts the URL from the request body.
3. Calls `crawlAndCheck` with the provided URL.
4. Streams the results back to the client in real-time.
5. Handles errors and closes the stream when finished.

### Key Features

- **Streaming**: Results are streamed back to the client in real-time, rather than waiting for all URLs to be checked.
- **Concurrency**: Uses `pLimit` to limit the number of concurrent requests, preventing overload of the target server.
- **Depth-limited crawling**: Crawls links found on pages up to a certain depth, allowing for more comprehensive checking.
- **Error handling**: Errors are caught and reported both for individual URL checks and the overall process.
- **Progress reporting**: Provides regular updates on the progress of the crawl.
