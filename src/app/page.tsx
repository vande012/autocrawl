// app/page.tsx
import Scraper from './components/Scraper'
import logo from './logo.png'
import Image from 'next/image'


export default function ScraperPage() {
  return (
    <div className="container mx-auto py-2 ">
      <div className="flex justify-center items-center">
      <Image 
        src={logo} // Path to your image in the public directory
        alt="Description of the logo"
        width={250} // Desired width of the image
        height={250} // Desired height of the image
        >
        </Image>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center">Auto-Crawl</h1>
      <Scraper />
    </div>
  )
}