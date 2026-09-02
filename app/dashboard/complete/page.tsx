import { Suspense } from "react";
import CompleteChecklistPage from "./CompleteChecklistPage";

export default function CompletePageWrapper() {
  return (
    <Suspense fallback={<p className="text-slate-600">Loading checklist...</p>}>
      <CompleteChecklistPage />
    </Suspense>
  );
}
