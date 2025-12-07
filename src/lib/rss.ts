
import { proxyFetch } from './api';

export interface ParsedRSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  media: { url: string; type: 'photo' | 'video' }[];
  categories: string[];
}

export const fetchRSS = async (url: string): Promise<ParsedRSSItem[]> => {
  try {
    const response = await proxyFetch(url);
    if (!response.ok) throw new Error(`Failed to fetch RSS: ${response.status}`);
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    
    const items = Array.from(xml.querySelectorAll("item"));
    
    return items.map(item => {
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      const description = item.querySelector("description")?.textContent || "";
      const contentEncoded = item.getElementsByTagNameNS("*", "encoded")[0]?.textContent || "";
      const categoryTags = Array.from(item.querySelectorAll("category"));
      const categories = categoryTags.map(c => c.textContent || "").filter(Boolean);

      // Extract Media
      const media: { url: string; type: 'photo' | 'video' }[] = [];
      
      // 1. Check <media:content> or <enclosure>
      const mediaElements = [
          ...Array.from(item.getElementsByTagNameNS("*", "content")), 
          ...Array.from(item.querySelectorAll("enclosure"))
      ];

      mediaElements.forEach(el => {
          const url = el.getAttribute("url");
          const type = el.getAttribute("type");
          // Filter low quality / tracking pixels (simple heuristic: size or length)
          const length = parseInt(el.getAttribute("length") || "0");
          
          if (url && (length > 5000 || !length)) { // Ignore very small files
              if (type?.startsWith("image")) media.push({ url, type: 'photo' });
              if (type?.startsWith("video")) media.push({ url, type: 'video' });
          }
      });

      // 2. Fallback: Parse HTML in description/content for <img>
      if (media.length === 0) {
          const htmlContent = contentEncoded || description;
          const doc = new DOMParser().parseFromString(htmlContent, "text/html");
          const imgs = Array.from(doc.querySelectorAll("img"));
          
          imgs.forEach(img => {
              const src = img.getAttribute("src");
              // Basic filter for tracking pixels or spacers
              if (src && !src.includes("ads") && !src.includes("pixel")) {
                  media.push({ url: src, type: 'photo' });
              }
          });
      }

      return { title, link, pubDate, description, media, categories };
    });
  } catch (error) {
    console.error("RSS Parse Error:", error);
    throw error;
  }
};
