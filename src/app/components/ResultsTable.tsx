import React, { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Parser } from 'json2csv';

interface ResultItem {
  url: string;
  statusCode: number | string;
  origin?: string;
  imagesWithoutAlt?: string[];  // Updated from imagesWithMissingAlt
  containsSearchTerm?: boolean;
}

interface ResultsTableProps {
  results: ResultItem[];
  checkAltText: boolean;
  searchTerm: string;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results, checkAltText, searchTerm }) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urlFilter, setUrlFilter] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<keyof ResultItem | "altTextMissing">("url");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const getStatusCodeClass = (statusCode: number | string): string => {
    const code = Number(statusCode);
    if (isNaN(code)) return "text-red-600";
    if (code >= 200 && code < 300) return "text-green-600";
    if (code >= 300 && code < 400) return "text-yellow-600";
    return "text-red-600";
  };

  const filteredAndSortedResults = useMemo(() => {
    return results
      .filter((result) => {
        if (statusFilter === "all") return true;
        const statusCode = Number(result.statusCode);
        if (isNaN(statusCode)) return statusFilter === "error";
        if (statusFilter === "success") return statusCode >= 200 && statusCode < 300;
        if (statusFilter === "redirect") return statusCode >= 300 && statusCode < 400;
        if (statusFilter === "error") return statusCode >= 400;
        return true;
      })
      .filter((result) => result.url.toLowerCase().includes(urlFilter.toLowerCase()))
      .sort((a, b) => {
        const compareValues = (aVal: string | boolean, bVal: string | boolean) => {
          if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
            return sortDirection === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
          }
          return sortDirection === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        };

        switch (sortColumn) {
          case "url":
            return compareValues(a.url, b.url);
          case "statusCode":
            return sortDirection === "asc" 
              ? Number(a.statusCode) - Number(b.statusCode)
              : Number(b.statusCode) - Number(a.statusCode);
          case "origin":
            return compareValues(a.origin || "", b.origin || "");
          case "altTextMissing":
            return compareValues(!!a.imagesWithoutAlt?.length, !!b.imagesWithoutAlt?.length);
          default:
            return 0;
        }
      });
  }, [results, statusFilter, urlFilter, sortColumn, sortDirection]);

  const handleSort = (column: keyof ResultItem | "altTextMissing") => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const downloadCSV = () => {
    const fields = ['url', 'statusCode', 'origin'];
    if (checkAltText) {
      fields.push('imagesWithoutAlt');
    }
    if (searchTerm) {
      fields.push('containsSearchTerm');
    }

    const opts = { fields };

    try {
      const parser = new Parser(opts);
      const csv = parser.parse(filteredAndSortedResults);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'crawl_results.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error generating CSV:', err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center m-4">
        <h2 className="text-xl font-semibold">Results: {filteredAndSortedResults.length} URLs</h2>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success (2xx)</SelectItem>
              <SelectItem value="redirect">Redirect (3xx)</SelectItem>
              <SelectItem value="error">Error (4xx, 5xx)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Filter by URL"
            value={urlFilter}
            onChange={(e) => setUrlFilter(e.target.value)}
            className="w-[200px] bg-white"
          />
          <Button onClick={downloadCSV}>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </Button>
        </div>
      </div>
      <div className="border rounded-md bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">
                <Button variant="ghost" onClick={() => handleSort("url")}>
                  URL {sortColumn === "url" && (sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("statusCode")}>
                  Status Code {sortColumn === "statusCode" && (sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4 " /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("origin")}>
                  Origin {sortColumn === "origin" && (sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                </Button>
              </TableHead>
              {checkAltText && (
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("altTextMissing")}>
                    Alt Text {sortColumn === "altTextMissing" && (sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                  </Button>
                </TableHead>
              )}
              {searchTerm && <TableHead>Search Term</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedResults.map((result, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{result.url}</TableCell>
                <TableCell className="text-center">
                  <span className={`font-bold ${getStatusCodeClass(result.statusCode)}`}>
                    {result.statusCode}
                  </span>
                </TableCell>
                <TableCell>{result.origin || "N/A"}</TableCell>
                {checkAltText && (
                  <TableCell>
                    {result.imagesWithoutAlt && result.imagesWithoutAlt.length > 0 ? (
                      <div>
                        <span className="text-red-600">Missing</span>
                        <ul className="list-disc pl-5 mt-2">
                          {result.imagesWithoutAlt.map((imgSrc, imgIndex) => (
                            <li key={imgIndex}>
                              <a href={imgSrc} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                Image {imgIndex + 1}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="text-green-600">Present</span>
                    )}
                  </TableCell>
                )}
                {searchTerm && (
                  <TableCell>
                    {result.containsSearchTerm ? (
                      <span className="text-green-600">Found</span>
                    ) : (
                      <span className="text-red-600">Not Found</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ResultsTable;