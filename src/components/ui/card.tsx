type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 ${className}`}
    >
      <h3 className="mb-4 text-lg font-semibold text-zinc-100">
        {title}
      </h3>
      {children}
    </div>
  );
}
