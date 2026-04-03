import React from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import { Metadata } from "next";
import { getAllSlugs, getPostBySlug } from "@/app/lib/blog";

export async function generateStaticParams() {
  return getAllSlugs();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} | Relentify`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishDate,
      authors: [post.author],
      images: [{ url: `https://relentify.com${post.image}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `https://relentify.com/blog/${post.slug}`,
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const formattedDate = new Date(post.publishDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: `https://relentify.com${post.image}`,
    author: {
      "@type": "Organization",
      name: "Relentify",
      url: "https://relentify.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Relentify",
      logo: {
        "@type": "ImageObject",
        url: "https://relentify.com/favicon.svg",
      },
    },
    datePublished: post.publishDate,
    dateModified: post.publishDate,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://relentify.com/blog/${post.slug}`,
    },
  };

  return (
    <div className="w-full pt-32 pb-20 px-6">
      <article className="max-w-3xl mx-auto">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--theme-accent)]">
            {post.category}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6 leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-[var(--theme-text-muted)]">
            <span>{formattedDate}</span>
            <span>·</span>
            <span>{post.author}</span>
            <span>·</span>
            <span>{post.readingTime}</span>
          </div>
        </div>

        {post.image && (
          <div className="mb-10 overflow-hidden rounded-2xl aspect-[16/9] relative">
            <Image
              src={post.image}
              alt={post.imageAlt || post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div
          className="prose prose-lg max-w-none
            text-[var(--theme-text)]
            prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-a:text-[var(--theme-accent)] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[var(--theme-text)]
            prose-p:leading-relaxed prose-p:mb-6"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-16 pt-8 border-t border-[var(--theme-border)]">
          <Link
            href="/blog"
            className="inline-block px-8 py-4 rounded-full font-bold text-sm bg-[var(--theme-accent)] text-white hover:opacity-90 transition-opacity"
          >
            Back to Blog
          </Link>
        </div>
      </article>
      <Script
        id={`blog-schema-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  );
}
