'use client';
import * as React from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

/**
 * Gentle fade-up when scrolled into view — as progressive enhancement.
 * Server HTML is always fully visible (SEO, no-JS, fast first paint). After
 * hydration, only elements that start below the fold are hidden and then
 * revealed on scroll. Static for reduced-motion users.
 */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (reduce || !ref.current) return;
    if (ref.current.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, [reduce]);

  const hidden = armed && !inView;
  const Comp = motion[as];
  return (
    <Comp
      ref={ref as never}
      className={className}
      initial={false}
      animate={hidden ? { opacity: 0, y: 18 } : { opacity: 1, y: 0 }}
      transition={hidden ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}
