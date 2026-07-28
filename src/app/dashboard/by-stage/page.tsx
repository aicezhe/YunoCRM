import { BarChart3 } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function ByStagePage() {
  return (
    <ComingSoon
      title="By stage"
      description="How the pipeline is distributed across the funnel right now."
      icon={BarChart3}
    />
  );
}
