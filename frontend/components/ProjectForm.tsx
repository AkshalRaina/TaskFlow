'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { errorMessage, toFieldErrors } from '@/lib/formErrors';
import type { Project } from '@/lib/types';
import { Button } from './ui/Button';
import { ErrorMessage } from './ui/Feedback';
import { Input, Textarea } from './ui/FormFields';

type ProjectFormProps = {
  /** Pass a project to edit it; leave empty to create a new one. */
  project?: Project;
  onSaved: () => void;
  onCancel: () => void;
};

export function ProjectForm({ project, onSaved, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFieldErrors({ name: 'Name is required' });
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const body = { name, description };
      if (project) {
        await api(`/projects/${project.id}`, { method: 'PATCH', body });
      } else {
        await api('/projects', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setFieldErrors(toFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorMessage message={error} />}
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        maxLength={100}
        autoFocus
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={fieldErrors.description}
        maxLength={1000}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}
