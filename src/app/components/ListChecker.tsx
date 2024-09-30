import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ListCheckerProps {
  setResults: React.Dispatch<React.SetStateAction<any[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setUrlsFound: React.Dispatch<React.SetStateAction<number>>;
}

const ListChecker: React.FC<ListCheckerProps> = ({ setResults, setIsLoading, setError, setUrlsFound }) => {
  const [urlList, setUrlList] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResults([]);
    setUrlsFound(0);

    const urls = urlList.split('\n').filter(url => url.trim() !== '');
    setUrlsFound(urls.length); // Set initial count to total number of URLs

    try {
      const response = await fetch("/api/check-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let processedCount = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.urlStatus) {
                  setResults((prev) => [...prev, data.urlStatus]);
                  processedCount++;
                  setUrlsFound(processedCount); // Update count for each processed URL
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
      }
    } catch (err) {
      let errorMessage = "An error occurred while checking URLs";
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={urlList}
        onChange={(e) => setUrlList(e.target.value)}
        placeholder="Enter URLs (one per line)"
        className="h-40"
        required
      />
      <Button type="submit">Check URLs</Button>
    </form>
  );
};

export default ListChecker;