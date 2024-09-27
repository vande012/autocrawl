import Scraper from "./components/Scraper";
import logo from "./logo.png";
import Image from "next/image";

export default function ScraperPage() {
  return (
    <div className="container mx-auto py-4 px-4 bg-gray-300">
      <div className="flex flex-col md:flex-row items-center md:items-start mb-6">
        <div className="md:mr-8 mb-4 md:mb-0">
          <Image
            src={logo}
            alt="Auto-Crawl Logo"
            width={250}
            height={250}
          />
        </div>
        <div className="flex-1 mt-6">
          <h1 className="text-3xl font-bold mb-4 text-center md:text-left">Auto-Crawl</h1>
          <h2 className="text-xl font-semibold mb-2 text-center md:text-left">
            Crawls Internal URLs | Checks Status Code | Shows Referring Origin
          </h2>
          <div className="mb-4">
            <p className="font-bold text-lg mb-2">Will not include:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>? Query Strings</li>
              <li>Images</li>
              <li>Certain File Types</li>
              <li># or modals</li>
              <li>/inventory slugs</li>
            </ul>
          </div>
          <p className="text-sm">
            For bugs, requests, and issues{" "}
            <a
              href="https://github.com/vande012/autocrawl/issues"
              className="text-blue-500 underline"
            >
              click here
            </a>.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <Scraper />
      </div>
    </div>
  );
}