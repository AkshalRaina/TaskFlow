import { Suspense } from 'react';
import { Spinner } from '@/components/ui/Feedback';
import { TaskDetails } from './TaskDetails';

// The task id comes from the URL, which needs a Suspense boundary in this Next.js version.
export default function TaskPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <TaskDetails />
    </Suspense>
  );
}
