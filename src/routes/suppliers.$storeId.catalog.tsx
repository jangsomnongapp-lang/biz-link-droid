import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/suppliers/$storeId/catalog")({
  component: () => <Outlet />,
});
