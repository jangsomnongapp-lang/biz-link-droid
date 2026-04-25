import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/announce")({
  component: () => <Navigate to="/listings/new" />,
});
