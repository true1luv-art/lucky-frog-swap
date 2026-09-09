import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-pixel text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 font-pixel text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 font-body text-lg text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-sm border-2 border-foreground bg-neon px-4 py-2 font-pixel text-xs text-primary-foreground transition-all hover:brightness-110"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
