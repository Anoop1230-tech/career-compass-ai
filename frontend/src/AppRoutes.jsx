import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { PAGES } from "./navigation";
// Home is the landing page: load it immediately so the first paint has content.
import HomePage from "./pages/HomePage";

// Lazy loading: other pages download only when first opened,
// so the first visit stays small and fast.
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        {PAGES.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={<ComingSoonPage title={page.title} description={page.description} phase={page.phase} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
