import { getAllPosts } from "@/app/lib/blog";
import BlogContent from "./BlogContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Insights for Growth | Relentify",
  description: "Thoughts on business, finance, property, and the technology that powers them. From the Relentify team.",
};

export default function BlogPage() {
  const posts = getAllPosts().map((post) => ({
    title: post.title,
    slug: post.slug,
    publishDate: post.publishDate,
    author: post.author,
    category: post.category,
    excerpt: post.excerpt,
    image: post.image,
    imageAlt: post.imageAlt,
    region: post.region,
    readingTime: post.readingTime,
  }));

  return <BlogContent posts={posts} />;
}
