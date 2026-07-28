import { ShieldAlert } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function QuarantinePage() {
  return (
    <ComingSoon
      title="Quarantine"
      description="Raw events the automation pipeline couldn't confidently resolve on its own, waiting for a human call."
      icon={ShieldAlert}
    />
  );
}
