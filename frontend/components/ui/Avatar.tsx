import { initials } from '@/lib/format';
import type { UserRef } from '@/lib/types';

const sizes = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
};

// A stable color per person, so the same user always looks the same.
const COLORS = ['bg-blue-600', 'bg-violet-600', 'bg-green-600', 'bg-amber-500', 'bg-pink-600', 'bg-cyan-600'];
function colorFor(id: string) {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return COLORS[sum % COLORS.length];
}

/** A person's initials in a circle. Shows a dashed circle for "unassigned". */
export function Avatar({ user, size = 'sm' }: { user: UserRef | null; size?: keyof typeof sizes }) {
  if (!user) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 ${sizes[size]}`}
        title="Unassigned"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(user.id)} ${sizes[size]}`}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  );
}
