import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({ children, className = '', onClick, hover = false }: CardProps) {
  const base =
    'bg-surface-800 border border-surface-700 rounded-xl p-5 transition-colors';
  const hoverClass = hover
    ? 'hover:border-accent-500/50 hover:bg-surface-800/80 cursor-pointer'
    : '';

  return (
    <div className={`${base} ${hoverClass} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
