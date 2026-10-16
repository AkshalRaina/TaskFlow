import { Suspense } from 'react';
import { Spinner } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { TasksPageContent } from './TasksPageContent';

export default function TasksPage() {
  return (
    <div>
      <PageHeader title="Tasks" subtitle="Search, filter and update tasks across all your projects." />
      {/* Filters come from the URL (e.g. /tasks?status=DONE), which needs a Suspense boundary in this Next.js version. */}
      <Suspense fallback={<Spinner />}>
        <TasksPageContent />
      </Suspense>
    </div>
  );
}
