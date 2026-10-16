export function Logo({ className = 'text-white' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-lg font-bold ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">T</span>
      TaskFlow
    </div>
  );
}
