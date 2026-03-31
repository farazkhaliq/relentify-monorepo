'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { spring } from '@relentify/ui';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0  },
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="hidden"
        animate="visible"
        variants={pageVariants}
        transition={spring.gentle}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
