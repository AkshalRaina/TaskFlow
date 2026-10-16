import { redirect } from "next/navigation";

// The app's home is the dashboard (logged-out visitors are sent on to /login from there).
export default function Home() {
  redirect("/dashboard");
}
