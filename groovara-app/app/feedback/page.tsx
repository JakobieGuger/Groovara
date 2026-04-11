import { Suspense } from "react";
import FeedbackForm from "./FeedbackForm";

export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackForm />
    </Suspense>
  );
}