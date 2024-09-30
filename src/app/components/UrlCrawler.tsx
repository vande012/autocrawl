import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface UrlCrawlerProps {
  url: string;
  setUrl: (url: string) => void;
  checkAltText: boolean;
  setCheckAltText: (check: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

const UrlCrawler: React.FC<UrlCrawlerProps> = ({
  url,
  setUrl,
  checkAltText,
  setCheckAltText,
  searchTerm,
  setSearchTerm,
  handleSubmit,
  isLoading
}) => {
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          placeholder="Enter website URL"
          required
          className="flex-grow bg-white"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Scanning..." : "Scan Site"}
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="checkAltText"
          checked={checkAltText}
          onCheckedChange={(checked: boolean) => setCheckAltText(checked)}
        />
        <Label htmlFor="checkAltText">Check for missing alt text on images</Label>
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          placeholder="Enter search term (optional)"
          className="flex-grow bg-white"
        />
      </div>
    </form>
  );
};

export default UrlCrawler;