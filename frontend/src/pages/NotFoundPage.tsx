import { Link } from "react-router-dom";
import { Button } from "../components/ui/primitives";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-1 px-4 text-center">
      <p className="font-mono text-sm text-teal-400">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/dashboard" className="mt-6">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
