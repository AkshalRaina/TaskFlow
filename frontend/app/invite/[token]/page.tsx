import { Suspense } from 'react';
import { Spinner } from '@/components/ui/Feedback';
import { InviteContent } from './InviteContent';

// The page an invitation email links to: /invite/<token>.
// The token comes from the URL, which needs a Suspense boundary in this Next.js version.
export default function InvitePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <InviteContent />
    </Suspense>
  );
}
