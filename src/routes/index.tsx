import { createFileRoute } from "@tanstack/react-router";
import Welcome from "@/components/screens/Welcome";

export const Route = createFileRoute("/")({
  component: Welcome,
});
