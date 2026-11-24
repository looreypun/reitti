import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Feedback';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage({ message = 'The page you’re looking for doesn’t exist.' }: { message?: string }) {
  useDocumentTitle('Not found');
  return (
    <div className="container">
      <EmptyState
        title="Not found"
        message={message}
        action={
          <Link to="/" className="btn btn--primary">
            Back to search
          </Link>
        }
      />
    </div>
  );
}
