'use client'

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UrlCrawler from "./UrlCrawler";
import ListChecker from "./ListChecker";
import ResultsTable from "./ResultsTable";
import { Progress } from "@/components/ui/progress";
import { Alert } from "@/components/ui/alert";

export interface UrlStatus {
  url: string;
  statusCode: number | string;
  origin?: string;
  altTextMissing?: boolean;
  imagesWithMissingAlt?: string[];
  containsSearchTerm?: boolean;
}

interface ProgressInfo {
  checked: number;
  total: number;
  queued: number;
}

const Scraper: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("crawler");
  const [url, setUrl] = useState<string>("");
  const [results, setResults] = useState<UrlStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<ProgressInfo>({ checked: 0, total: 1, queued: 0 });
  const [checkAltText, setCheckAltText] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showProgress, setShowProgress] = useState<boolean>(false);

  useEffect(() => {
    if (isLoading || progress.checked > 0) {
      setShowProgress(true);
    } else if (progress.checked === progress.total && progress.total > 0) {
      const timer = setTimeout(() => setShowProgress(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, progress]);

  const handleCrawlerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResults([]);
    setProgress({ checked: 0, total: 1, queued: 1 });
    setShowProgress(true);

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
              }
              if (data.progress) {
                setProgress(data.progress);
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
            setProgress={setProgress}
            setShowProgress={setShowProgress}
          />
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="my-4">
          <p>{error}</p>
        </Alert>
      )}

      {showProgress && (
        <div className="my-4">
          <Progress 
            value={(progress.checked / Math.max(progress.total, 1)) * 100} 
            className="w-full"
          />
          <p className="text-center mt-2">
            {((progress.checked / Math.max(progress.total, 1)) * 100).toFixed(2)}% Complete
          </p>
          <p className="text-center">
            Checked: {progress.checked} | Total: {progress.total} | Queued: {progress.queued}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <ResultsTable results={results} checkAltText={checkAltText} searchTerm={searchTerm} />
      )}
    </div>
  );
};

export default Scraper;