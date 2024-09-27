"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Parser } from "json2csv";

interface UrlStatus {
  url: string;
  statusCode: number | string;
  origin?: string; // Add origin property
}

interface ProgressInfo {
  checked: number;
  total: number;
  queued: number;
}

const Scraper = () => {
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<UrlStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ProgressInfo>({
    checked: 0,
    total: 0,
    queued: 0,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [urlFilter, setUrlFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<"url" | "statusCode" | "origin">(
    "url"
  ); // Update sort column
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "asc"
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResults([]);
    setProgress({ checked: 0, total: 0, queued: 0 });

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line) {
              try {
                const data = JSON.parse(line);
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
      }
    } catch (err) {
      setError("An error occurred while fetching data");
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedResults = useMemo(() => {
    return results
      .filter((result) => {
        if (statusFilter === "all") return true;
        const statusCode = Number(result.statusCode);
        if (isNaN(statusCode)) return statusFilter === "error";
        if (statusFilter === "success")
          return statusCode >= 200 && statusCode < 300;
        if (statusFilter === "redirect")
          return statusCode >= 300 && statusCode < 400;
        if (statusFilter === "error") return statusCode >= 400;
        return true;
      })
      .filter((result) =>
        result.url.toLowerCase().includes(urlFilter.toLowerCase())
      )
      .map((result) => {
        const statusCode = Number(result.statusCode);
        let color = "black"; // Default color

        if (!isNaN(statusCode)) {
          if (statusCode >= 200 && statusCode < 300) {
            color = "green";
          } else if (statusCode >= 300 && statusCode < 400) {
            color = "orange";
          } else if (statusCode >= 400) {
            color = "red";
          }
        } else if (statusFilter === "error") {
          color = "red";
        }

        return { ...result, color };
      })
      .sort((a, b) => {
        if (sortColumn === "url") {
          return sortDirection === "asc"
            ? a.url.localeCompare(b.url)
            : b.url.localeCompare(a.url);
        } else if (sortColumn === "origin") {
          return sortDirection === "asc"
            ? (a.origin || "").localeCompare(b.origin || "")
            : (b.origin || "").localeCompare(a.origin || "");
        } else {
          const aCode = Number(a.statusCode);
          const bCode = Number(b.statusCode);
          if (isNaN(aCode) || isNaN(bCode)) {
            return sortDirection === "asc"
              ? String(a.statusCode).localeCompare(String(b.statusCode))
              : String(b.statusCode).localeCompare(String(a.statusCode));
          }
          return sortDirection === "asc" ? aCode - bCode : bCode - aCode;
        }
      });
  }, [results, statusFilter, urlFilter, sortColumn, sortDirection]);

  const handleSort = (column: "url" | "statusCode" | "origin") => {
    if (sortColumn === column) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : prev === "desc" ? null : "asc"
      );
      if (sortDirection === null) {
        setSortColumn(column);
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const downloadCSV = () => {
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(results);

    // Create a blob and trigger a download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const urlBlob = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = urlBlob;
    link.setAttribute("download", "results.csv"); // Specify the file name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setUrl(e.target.value)
            }
            placeholder="Enter website URL"
            required
            className="flex-grow bg-white"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Scanning..." : "Scan Site"}
          </Button>
        </div>
      </form>

      {(isLoading || progress.checked > 0) && (
        <div className="mb-4">
          <Progress
            value={
              (progress.checked / (progress.total + progress.queued)) * 100
            }
            className="w-full"
          />
          <p className="text-center mt-2">
            {(
              (progress.checked / (progress.total + progress.queued)) *
              100
            ).toFixed(2)}
            % Complete
          </p>
          <p className="text-center">
            Checked: {progress.checked} | Total: {progress.total} | Queued:{" "}
            {progress.queued}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Results: {filteredAndSortedResults.length} URLs
            </h2>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success (2xx)</SelectItem>
                  <SelectItem value="redirect">Redirect (3xx)</SelectItem>
                  <SelectItem value="error">Error (4xx, 5xx)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={downloadCSV}>Download CSV</Button>
            </div>
          </div>
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">
                    <div className="flex items-center">
                      URL
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("url")}
                      >
                        {sortColumn === "url" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : sortDirection === "desc" ? (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="w-[30%]">
                    <div className="flex items-center">
                      Status Code
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("statusCode")}
                      >
                        {sortColumn === "statusCode" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : sortDirection === "desc" ? (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="w-[30%]">
                    <div className="flex items-center">
                      Origin
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort("origin")}
                      >
                        {sortColumn === "origin" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : sortDirection === "desc" ? (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.url}</TableCell>
                    <TableCell
                      style={{
                        color: result.color,
                        fontSize: "16px",
                        fontWeight: "bold",
                      }}
                    >
                      {result.statusCode}
                    </TableCell>
                    <TableCell>{result.origin || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scraper;
