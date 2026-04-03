'use client';
import React from 'react';
import { useTheme } from '@relentify/ui';
import { motion } from 'motion/react';
import { ArrowRight, Clock, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface BlogPostPreview {
  title: string;
  slug: string;
  publishDate: string;
  author: string;
  category: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  readingTime: string;
}

export default function BlogContent({ posts }: { posts: BlogPostPreview[] }) {
  const { theme } = useTheme();

  return (
    <div className="w-full pt-32 px-6">
      <section className="max-w-7xl mx-auto mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-accent mb-4">The Relentify Blog</p>
          <h1 className={`text-6xl md:text-8xl font-bold mb-6 ${theme.typography.headings}`}>
            Insights for <span className={theme.typography.drama}>Growth.</span>
          </h1>
          <p className="text-xl text-[var(--theme-text-muted)] max-w-2xl mx-auto">
            Thoughts on business, finance, property, and the technology that powers them.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {posts.map((post, i) => (
            <motion.article
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <Link href={`/blog/${post.slug}`} className="block no-underline">
                <div className="aspect-[16/10] rounded-2xl overflow-hidden mb-8 relative">
                  <Image
                    src={post.image}
                    alt={post.imageAlt || post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-6 left-6">
                    <span className="px-4 py-2 rounded-full bg-[var(--theme-card)]/90 backdrop-blur-md text-xs font-bold uppercase tracking-widest">
                      {post.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest opacity-40 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={12} />
                    {new Date(post.publishDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={12} />
                    {post.author}
                  </div>
                </div>

                <h2 className={`text-2xl font-bold mb-4 group-hover:text-[var(--theme-accent)] transition-colors ${theme.typography.headings}`}>
                  {post.title}
                </h2>

                <p className="text-sm text-[var(--theme-text-muted)] mb-6 line-clamp-3 leading-relaxed">
                  {post.excerpt}
                </p>

                <div className="flex items-center gap-2 font-bold text-xs group-hover:gap-4 transition-all">
                  Read Article <ArrowRight size={14} />
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
