interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-md)',
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background:
          'linear-gradient(90deg, var(--surface-interactive) 25%, var(--surface-overlay) 50%, var(--surface-interactive) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}
