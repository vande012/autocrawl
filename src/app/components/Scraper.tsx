'use client'

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UrlCrawler from "./UrlCrawler";
import ListChecker from "./ListChecker";
import ResultsTable from "./ResultsTable";
import { Alert } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export interface UrlStatus {
  url: string;
  statusCode: number | string;
  origin?: string;
  altTextMissing?: boolean;
  imagesWithMissingAlt?: string[];
  containsSearchTerm?: boolean;
}

const Scraper: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("crawler");
  const [url, setUrl] = useState<string>("");
  const [results, setResults] = useState<UrlStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [urlsFound, setUrlsFound] = useState<number>(0);
  const [checkAltText, setCheckAltText] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleCrawlerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResults([]);
    setUrlsFound(0);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, checkAltText, searchTerm }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.urlStatus) {
                setResults((prev) => [...prev, data.urlStatus]);
                setUrlsFound((prev) => prev + 1);
              }
              if (data.error) {
                setError(data.error);
              }
              if (data.status === "Completed") {
                setIsLoading(false);
              }
            } catch (err) {
              console.error("Error parsing JSON:", err);
            }
          }
        }
      }
    } catch (err) {
      let errorMessage = "An error occurred while crawling";
      if (err instanceof Error) {
        errorMessage += `: ${err.message}`;
      }
      setError(errorMessage);
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="crawler">Domain Crawler</TabsTrigger>
          <TabsTrigger value="listChecker">URL List Checker</TabsTrigger>
        </TabsList>
        <TabsContent value="crawler">
          <UrlCrawler
            url={url}
            setUrl={setUrl}
            checkAltText={checkAltText}
            setCheckAltText={setCheckAltText}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSubmit={handleCrawlerSubmit}
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="listChecker">
          <ListChecker
            setResults={setResults}
            setIsLoading={setIsLoading}
            setError={setError}
            setUrlsFound={setUrlsFound}
          />
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="my-4">
          <p>{error}</p>
        </Alert>
      )}

      <div className="my-4 space-y-4">
        {(isLoading || urlsFound > 0) && (
          <div className="flex flex-col items-center bg-gray-100 p-4 rounded-md shadow">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">✓</div>
            )}
            <p className="mt-2 text-center font-semibold">
              {isLoading ? "Crawling in progress..." : "Crawling complete"}
            </p>
            <p className="text-center">
              URLs found: {urlsFound}
            </p>
          </div>
        )}

        {results.length > 0 && (
          <ResultsTable results={results} checkAltText={checkAltText} searchTerm={searchTerm} />
        )}
      </div>
    </div>
  );
};

export default Scraper;