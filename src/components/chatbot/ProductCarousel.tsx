'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductCarouselProps {
  products: Product[];
  onInquire?: (product: Product) => void;
}

export function ProductCarousel({ products, onInquire }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' });
    }
  };

  if (!products.length) return null;

  return (
    <div className="relative w-full">
      {/* Scroll arrows — inset so they don't overflow the widget */}
      {products.length > 1 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-surface-alt border border-border-subtle flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 transition-all shadow-md"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-surface-alt border border-border-subtle flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 transition-all shadow-md"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Scrollable Row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-1 px-3"
      >
        {products.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex-shrink-0"
          >
            <ProductCard product={product} onInquire={onInquire} compact />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
