import { Clock } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function TimePage() {
  return (
    <ComingSoon
      title="Time"
      description="How long prospects spend in each stage before moving on."
      icon={Clock}
    />
  );
}
