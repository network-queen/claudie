interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'muted';
  className?: string;
}

const variantClasses: Record<string, string> = {
  default: 'bg-surface-700 text-surface-300',
  accent: 'bg-accent-500/20 text-accent-400',
  muted: 'bg-surface-700/50 text-surface-500',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
