import Scraper from "./components/Scraper";
import logo from "./logo.png";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ScraperPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-500 to-gray-300 py-8 px-4">
      <div className="container mx-auto max-w-9xl">
        <Card className="bg-gray-300 shadow-xl">
          <CardHeader className="pb-0">
            <div className="flex flex-col md:flex-row items-center md:items-start">
              <div className="md:mr-8 mb-4 md:mb-0 bg-white rounded-md">
                <Image
                  src={logo}
                  alt="Auto-Crawl Logo"
                  width={200}
                  height={200}
                  className="rounded-lg shadow-md"
                />
              </div>
              <div className="flex-1">
                <CardTitle className="text-3xl font-bold mb-2 text-center md:text-left">
                  Auto-Crawl
                </CardTitle>
                <p className="text-xl text-gray-600 mb-4 text-center md:text-left">
                  Crawls Internal URLs | Checks Status Code | Shows Referring
                  Origin
                </p>
                <Separator className="my-4" />
                <div className="mb-4">
                  <h3 className="font-semibold text-lg mb-2">
                    Will not include:
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    <li>? Query Strings</li>
                    <li>Images</li>
                    <li>Certain File Types - .php .css .js</li>
                    <li># or modals</li>
                    <li>/inventory slugs</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-500">
                  For bugs, requests, and issues{" "}
                  <a
                    href="https://github.com/vande012/autocrawl/issues"
                    className="text-blue-500 hover:text-blue-600 underline transition-colors"
                  >
                    click here
                  </a>
                  .
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Scraper />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
