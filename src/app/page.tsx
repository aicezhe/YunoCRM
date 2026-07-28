import { redirect } from "next/navigation";

// The middleware bounces unauthenticated visitors to /login before this runs.
export default function Home() {
  redirect("/dashboard");
}
