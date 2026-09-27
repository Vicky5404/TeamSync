import { Compass } from 'lucide-react';
import { Link } from 'react-router';

import { buttonStyles } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { paths } from './paths';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has been moved."
        action={
          <Link to={paths.root} className={buttonStyles()}>
            Go home
          </Link>
        }
      />
    </div>
  );
}
