'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { Eye, MessageSquare, Tag, Star } from 'lucide-react';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/dhon/mapProduct';

interface ProductCardProps {
  product: Product;
  onInquire?: (product: Product) => void;
  compact?: boolean;
}

const BADGE_COLORS: Record<string, string> = {
  'Best Seller': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Most Durable': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Premium': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Professional Grade': 'bg-primary/20 text-primary border-primary/30',
  'Hospitality Grade': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Café Grade': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Bundle Deal': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Hotel Grade': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'Restaurant Grade': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'Industrial Grade': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function ProductCard({ product, onInquire, compact = false }: ProductCardProps) {
  const [imageSrc, setImageSrc] = useState(product.image || PRODUCT_IMAGE_PLACEHOLDER);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset image state when product changes
  useEffect(() => {
    setImageSrc(product.image || PRODUCT_IMAGE_PLACEHOLDER);
    setImageLoaded(false);
  }, [product.id, product.image]);

  const badgeClass = product.badge
    ? (BADGE_COLORS[product.badge] || 'bg-primary/20 text-primary border-primary/30')
    : '';

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="glass-card rounded-2xl overflow-hidden border border-border-subtle hover:border-primary/30 transition-all duration-300 group flex flex-col"
      style={{ minWidth: compact ? '180px' : '200px', maxWidth: compact ? '200px' : '220px' }}
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-surface-alt">
        {/* Skeleton shimmer — visible until image settles */}
        <div
          className={`absolute inset-0 bg-surface-alt transition-opacity duration-300 ${imageLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse'}`}
          aria-hidden
        />
        <img
          src={imageSrc}
          alt={product.name}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (imageSrc !== PRODUCT_IMAGE_PLACEHOLDER) {
              setImageSrc(PRODUCT_IMAGE_PLACEHOLDER);
              setImageLoaded(true);
            }
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />

        {/* Badge */}
        {product.badge && (
          <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
            {product.badge}
          </div>
        )}

        {/* Price */}
        {product.priceRange && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10">
            <span className="text-white/80 text-[11px] font-medium">{product.priceRange}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-serif text-sm text-text-primary font-semibold mb-1 leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {product.name}
        </h4>

        {/* Benefit */}
        <p className="text-[11px] text-primary font-medium mb-2 flex items-center gap-1.5">
          <Star className="w-3 h-3 shrink-0" />
          {product.benefit}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
          {product.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-200/50 border border-border-subtle text-[10px] text-text-muted"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-auto">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border-subtle text-text-muted text-[11px] font-medium hover:border-primary/40 hover:text-primary transition-all"
            onClick={() => {
              if (product.productUrl) {
                // Use window.top so the link escapes the embed iframe on client sites
                const target = window.top ?? window;
                target.open(product.productUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!product.productUrl}
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[11px] font-bold hover:bg-primary hover:text-text-on-primary transition-all"
            onClick={() => onInquire?.(product)}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Inquire
          </button>
        </div>
      </div>
    </motion.div>
  );
}
