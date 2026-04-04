import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import readingTime from 'reading-time';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export type BlogRegion = 'all' | 'uk' | 'usa';

export interface BlogPost {
  title: string;
  slug: string;
  publishDate: string;
  author: string;
  category: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  tags: string[];
  region: BlogRegion;
  readingTime: string;
}

export interface BlogPostWithContent extends BlogPost {
  content: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

  const posts = files
    .map((filename) => {
      const filePath = path.join(BLOG_DIR, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);
      const stats = readingTime(content);

      return {
        title: data.title,
        slug: data.slug,
        publishDate: data.publishDate,
        author: data.author,
        category: data.category,
        excerpt: data.excerpt,
        image: data.image,
        imageAlt: data.imageAlt || '',
        tags: data.tags || [],
        region: (data.region as BlogRegion) || 'all',
        readingTime: stats.text,
      } as BlogPost;
    })
    .filter((post) => process.env.PREVIEW === 'true' || new Date(post.publishDate) <= new Date())
    .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());

  return posts;
}

export async function getPostBySlug(slug: string): Promise<BlogPostWithContent | null> {
  if (!fs.existsSync(BLOG_DIR)) return null;

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

  for (const filename of files) {
    const filePath = path.join(BLOG_DIR, filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContents);

    if (data.slug === slug) {
      const processedContent = await remark().use(html).process(content);
      const stats = readingTime(content);

      return {
        title: data.title,
        slug: data.slug,
        publishDate: data.publishDate,
        author: data.author,
        category: data.category,
        excerpt: data.excerpt,
        image: data.image,
        imageAlt: data.imageAlt || '',
        tags: data.tags || [],
        region: (data.region as BlogRegion) || 'all',
        readingTime: stats.text,
        content: processedContent.toString(),
      };
    }
  }

  return null;
}

export function getAllSlugs(): { slug: string }[] {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}
