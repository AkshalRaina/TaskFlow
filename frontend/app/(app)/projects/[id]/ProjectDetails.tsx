'use client';

import { ArrowLeft, ListTodo, Pencil, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { MembersPanel } from '@/components/MembersPanel';
import { ProjectForm } from '@/components/ProjectForm';
import { TasksView } from '@/components/TasksView';
import { Button } from '@/components/ui/Button';
import { ProgressBar, RoleBadge } from '@/components/ui/Display';
import { ErrorMessage, Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { canManage, formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/formErrors';
import type { Project } from '@/lib/types';

type Tab = 'tasks' | 'members';

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const project = useApi<Project>(`/projects/${id}`);
  const [tab, setTab] = useState<Tab>('tasks');
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete() {
    if (!project.data || !window.confirm(`Delete "${project.data.name}" and all of its tasks?`)) return;
    try {
      await api(`/projects/${id}`, { method: 'DELETE' });
      router.push('/projects');
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  const backLink = (
    <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <ArrowLeft size={16} /> All projects
    </Link>
  );

  if (project.error) {
    return (
      <div>
        {backLink}
        <ErrorMessage message={project.error} />
      </div>
    );
  }

  if (!project.data) {
    return <Spinner />;
  }

  const { name, description, createdAt, doneTasks, totalTasks, progress, myRole, memberCount } = project.data;
  const isAdmin = canManage(myRole);

  return (
    <div>
      {backLink}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              <RoleBadge role={myRole} />
            </div>
            {description && <p className="mt-1 text-slate-600">{description}</p>}
            <p className="mt-2 text-xs text-slate-400">Created {formatDate(createdAt)}</p>
          </div>
          {/* Only the owner/admins can change or delete the project. */}
          {isAdmin && (
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit
              </Button>
              <Button variant="secondary" onClick={handleDelete} className="text-red-600">
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-slate-600">
              {doneTasks} of {totalTasks} {isAdmin ? '' : 'of your '}tasks completed
            </span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
        {deleteError && (
          <div className="mt-4">
            <ErrorMessage message={deleteError} />
          </div>
        )}
      </div>

      <div className="mb-6 flex gap-1 border-b border-slate-200" role="tablist">
        <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')} icon={<ListTodo size={16} />}>
          {isAdmin ? 'All tasks' : 'My tasks'}
        </TabButton>
        <TabButton active={tab === 'members'} onClick={() => setTab('members')} icon={<Users size={16} />}>
          Members & roles <span className="text-slate-400">({memberCount})</span>
        </TabButton>
      </div>

      {tab === 'tasks' ? (
        // Refresh the progress bar whenever a task changes.
        <TasksView projectId={id} onTasksChanged={project.reload} />
      ) : (
        <MembersPanel projectId={id} canManage={isAdmin} onChanged={project.reload} />
      )}

      {editing && (
        <Modal title="Edit project" onClose={() => setEditing(false)}>
          <ProjectForm
            project={project.data}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              project.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
