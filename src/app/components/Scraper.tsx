// src/app/components/Scraper.tsx
'use client'

import React, { useState, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface UrlStatus {
  url: string;
  statusCode: number | string;
}

type SortDirection = 'asc' | 'desc' | null;

const isNumberStatusCode = (statusCode: number | string): statusCode is number => {
  return typeof statusCode === 'number';
};

const Scraper = () => {
  const [url, setUrl] = useState('')
  const [results, setResults] = useState<UrlStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [urlFilter, setUrlFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<'url' | 'statusCode'>('url')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [totalUrls, setTotalUrls] = useState(0)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResults([])
    setProgress(0)
    setTotalUrls(0)

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line) {
              const data = JSON.parse(line)
              if (data.totalUrls) {
                setTotalUrls(data.totalUrls)
              } else if (data.urlStatus) {
                setResults(prev => [...prev, data.urlStatus])
                setProgress(prev => (results.length / totalUrls) * 100)
              } else if (data.error) {
                setError(data.error)
              }
            }
          }
        }
      }
    } catch (err) {
      setError('An error occurred while fetching data')
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
      setProgress(100)
    }
  }

  const filteredAndSortedResults = useMemo(() => {
    return results
      .filter(result => {
        if (statusFilter === 'all') return true;
        if (isNumberStatusCode(result.statusCode)) {
          if (statusFilter === 'success') return result.statusCode >= 200 && result.statusCode < 300;
          if (statusFilter === 'error') return result.statusCode >= 400;
        } else {
          if (statusFilter === 'error') return result.statusCode === 'Error';
          return false;
        }
        return true;
      })
      .filter(result => result.url.toLowerCase().includes(urlFilter.toLowerCase()))
      .sort((a, b) => {
        if (sortColumn === 'url') {
          return sortDirection === 'asc' 
            ? a.url.localeCompare(b.url)
            : b.url.localeCompare(a.url);
        } else {
          if (isNumberStatusCode(a.statusCode) && isNumberStatusCode(b.statusCode)) {
            return sortDirection === 'asc'
              ? a.statusCode - b.statusCode
              : b.statusCode - a.statusCode;
          } else {
            return sortDirection === 'asc'
              ? String(a.statusCode).localeCompare(String(b.statusCode))
              : String(b.statusCode).localeCompare(String(a.statusCode));
          }
        }
      });
  }, [results, statusFilter, urlFilter, sortColumn, sortDirection]);

  const handleSort = (column: 'url' | 'statusCode') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDirection === null) {
        setSortColumn(column);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const downloadCSV = () => {
    const csvContent = "URL,Status Code\n" + filteredAndSortedResults.map(result => `"${result.url}","${result.statusCode}"`).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'scraped_urls.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
            placeholder="Enter website URL"
            required
            className="flex-grow"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Scanning...' : 'Scan Site'}
          </Button>
        </div>
      </form>

      {(isLoading || progress > 0) && (
        <div className="mb-4">
          <Progress value={progress} className="w-full" />
          <p className="text-center mt-2">{progress.toFixed(0)}% Complete</p>
          {totalUrls > 0 && (
            <p className="text-center">Processed: {results.length} / {totalUrls} URLs</p>
          )}
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
            <h2 className="text-xl font-semibold">Results: {filteredAndSortedResults.length} URLs</h2>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success (2xx)</SelectItem>
                  <SelectItem value="error">Error (4xx, 5xx)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={downloadCSV}>Download CSV</Button>
            </div>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70%]">
                    <div className="flex items-center">
                      URL
                      <Button variant="ghost" size="sm" onClick={() => handleSort('url')}>
                        {sortColumn === 'url' ? (
                          sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> :
                          sortDirection === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> :
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Input
                      placeholder="Filter URLs"
                      value={urlFilter}
                      onChange={(e) => setUrlFilter(e.target.value)}
                      className="mt-2"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end">
                      Status Code
                      <Button variant="ghost" size="sm" onClick={() => handleSort('statusCode')}>
                        {sortColumn === 'statusCode' ? (
                          sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> :
                          sortDirection === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> :
                          <ArrowUpDown className="ml-2 h-4 w-4" />
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
                    <TableCell className="font-medium">{result.url}</TableCell>
                    <TableCell className="text-right">{result.statusCode}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Scraper