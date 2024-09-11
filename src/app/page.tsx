// app/page.tsx
import Scraper from './components/Scraper'

export default function ScraperPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Web Scraper Tool</h1>
      <Scraper />
    </div>
  )
}