import React from 'react';
import { useTheme } from '../App';
import { motion } from 'motion/react';
import { ArrowRight, Clock, User, Tag } from 'lucide-react';

const posts = [
  {
    title: "Why Modern Businesses are Leaving Xero",
    excerpt: "For years, Xero was the default choice for small business accounting. However, as the platform has aged, many users are finding it increasingly difficult to justify the cost and complexity.",
    author: "Relentify Team",
    date: "Mar 20, 2026",
    category: "Insights",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    link: "/xero-alternative"
  },
  {
    title: "10 Reasons to Switch from QuickBooks to Relentify",
    excerpt: "QuickBooks is a giant in the industry, but being a giant often means moving slowly. Here are the top reasons businesses are switching to a more agile platform.",
    author: "Product Team",
    date: "Mar 18, 2026",
    category: "Product",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800",
    link: "/quickbooks-alternative"
  },
  {
    title: "How Multi-Business Management Saves Hours Every Week",
    excerpt: "If you manage more than one business, you know the pain of logging in and out of different accounts. Relentify solves this with native multi-business support.",
    author: "Relentify Team",
    date: "Mar 17, 2026",
    category: "Insights",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800",
    link: "/xero-v-relentify"
  },
  {
    title: "How to Simplify Accounting for Small Business Owners",
    excerpt: "Accounting shouldn't be a full-time job for a business owner. It should be a tool that supports your growth without getting in the way.",
    author: "Relentify Team",
    date: "Mar 16, 2026",
    category: "Insights",
    image: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&q=80&w=800",
    link: "/alternatives"
  },
  {
    title: "Relentify vs Legacy Accounting Software: The Feature Comparison",
    excerpt: "When you compare Relentify to legacy systems, the difference in philosophy is clear. We build for speed and transparency.",
    author: "Product Team",
    date: "Mar 15, 2026",
    category: "Product",
    image: "https://images.unsplash.com/photo-1454165833767-027ffea9e778?auto=format&fit=crop&q=80&w=800",
    link: "/quickbooks-v-relentify"
  }
];

export default function Blog() {
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
              onClick={() => window.location.href = post.link || '#'}
            >
              <div className="aspect-[16/10] rounded-cinematic overflow-hidden mb-8 relative">
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6">
                  <span className="px-4 py-2 rounded-full bg-[var(--theme-card)]/90 backdrop-blur-md text-[var(--theme-text-10)] font-bold uppercase tracking-widest">
                    {post.category}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-[var(--theme-text-10)] font-bold uppercase tracking-widest opacity-40 mb-4">
                <div className="flex items-center gap-2"><Clock size={12} /> {post.date}</div>
                <div className="flex items-center gap-2"><User size={12} /> {post.author}</div>
              </div>
              
              <h2 className={`text-2xl font-bold mb-4 group-hover:text-accent transition-colors ${theme.typography.headings}`}>
                {post.title}
              </h2>
              
              <p className="text-sm text-[var(--theme-text-muted)] mb-6 line-clamp-3 leading-relaxed">
                {post.excerpt}
              </p>
              
              <div className="flex items-center gap-2 font-bold text-xs group-hover:gap-4 transition-all">
                Read Article <ArrowRight size={14} />
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-7xl mx-auto py-32 border-t border-[var(--theme-border)]">
        <div className="bg-[var(--theme-dark)] rounded-cinematic p-12 md:p-20 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[var(--theme-background-blur)]" />
          <div className="relative z-10">
            <h2 className={`text-4xl md:text-6xl font-bold mb-6 ${theme.typography.headings}`}>Stay in the loop.</h2>
            <p className="text-xl text-[var(--theme-text-muted)] mb-12 max-w-xl mx-auto">
              Get the latest insights and product updates delivered straight to your inbox.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center max-w-md mx-auto">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="px-8 py-4 rounded-full bg-[var(--theme-card)]/10 border border-[var(--theme-card)]/10 focus:outline-none focus:border-accent w-full"
              />
              <button 
                className="px-8 py-4 rounded-full font-bold text-white shadow-cinematic whitespace-nowrap bg-[var(--theme-accent)]"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
