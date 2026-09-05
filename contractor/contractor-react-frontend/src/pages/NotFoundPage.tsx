import { Link } from 'react-router-dom'

import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="text-5xl" aria-hidden="true">
        🧭
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">We could not find that page</h1>
      <p className="mt-2 text-sm text-slate-600">
        It may have been removed, or it may belong to someone else — projects and quotes are only
        visible to the people on them.
      </p>
      <Link to="/" className="mt-6">
        <Button size="lg">Back to home</Button>
      </Link>
    </div>
  )
}
