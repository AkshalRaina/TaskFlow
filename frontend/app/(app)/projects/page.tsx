'use client';

import { FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { ProjectCard, projectColor } from '@/components/ProjectCard';
import { ProjectForm } from '@/components/ProjectForm';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorMessage, Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/formErrors';
import type { Project } from '@/lib/types';

export default function ProjectsPage() {
  const projects = useApi<{ data: Project[] }>('/projects');
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete(project: Project) {
    const message = `Delete "${project.name}"? This also deletes its ${project.totalTasks} task(s).`;
    if (!window.confirm(message)) return;

    setDeleteError('');
    try {
      await api(`/projects/${project.id}`, { method: 'DELETE' });
      projects.reload();
    } catch (err) {
      setDeleteError(errorMessage(err));
    }
  }

  const list = projects.data?.data;

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Manage your projects and track progress."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} /> New project
          </Button>
        }
      />

      {deleteError && (
        <div className="mb-4">
          <ErrorMessage message={deleteError} />
        </div>
      )}

      {projects.error ? (
        <ErrorMessage message={projects.error} onRetry={projects.reload} />
      ) : !list ? (
        <Spinner label="Loading projects..." />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<FolderPlus size={40} />}
          title="No projects yet"
          description="Projects group related tasks together. Create one to get started."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} /> Create your first project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              color={projectColor(index)}
              onEdit={() => setEditing(project)}
              onDelete={() => handleDelete(project)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New project' : 'Edit project'} onClose={() => setEditing(null)}>
          <ProjectForm
            project={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              projects.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
