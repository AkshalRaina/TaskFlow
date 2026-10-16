import { Pencil, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { canManage, formatDate } from '@/lib/format';
import type { Project } from '@/lib/types';
import { ProgressBar, RoleBadge } from './ui/Display';

type ProjectCardProps = {
  project: Project;
  color: string;
  onEdit: () => void;
  onDelete: () => void;
};

/** The whole card opens the project. Edit/delete buttons are only shown to the project's owner/admins. */
export function ProjectCard({ project, color, onEdit, onDelete }: ProjectCardProps) {
  const isAdmin = canManage(project.myRole);

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md">
      {/* Covers the whole card, so clicking anywhere opens the project. */}
      <Link href={`/projects/${project.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${project.name}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1.5 h-3 w-3 shrink-0 rounded ${color}`} />
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{project.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description || 'No description'}</p>
          </div>
        </div>
        {/* `relative` lifts the buttons above the card-wide link so they stay clickable. */}
        {isAdmin && (
          <div className="relative flex shrink-0">
            <button onClick={onEdit} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit ${project.name}`}>
              <Pencil size={16} />
            </button>
            <button onClick={onDelete} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${project.name}`}>
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-slate-600">
            {project.doneTasks} of {project.totalTasks} {isAdmin ? '' : 'of your '}tasks completed
          </span>
          <span className="font-semibold text-slate-900">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} color={color} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <RoleBadge role={project.myRole} />
          <span className="flex items-center gap-1">
            <Users size={12} /> {project.memberCount}
          </span>
        </span>
        <span className="text-slate-400">Created {formatDate(project.createdAt)}</span>
      </div>
    </div>
  );
}

const PROJECT_COLORS = ['bg-blue-600', 'bg-violet-600', 'bg-green-600', 'bg-amber-500', 'bg-pink-600', 'bg-cyan-600'];

/** Gives each project in a list its own color. */
export function projectColor(index: number) {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}
