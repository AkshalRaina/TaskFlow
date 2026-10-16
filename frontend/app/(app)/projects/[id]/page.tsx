import { Suspense } from 'react';
import { Spinner } from '@/components/ui/Feedback';
import { ProjectDetails } from './ProjectDetails';

// The project id comes from the URL, which needs a Suspense boundary in this Next.js version.
export default function ProjectPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProjectDetails />
    </Suspense>
  );
}
