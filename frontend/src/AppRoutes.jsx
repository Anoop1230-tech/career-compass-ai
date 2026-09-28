import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PAGES } from "./navigation";
// Home is the landing page: load it immediately so the first paint has content.
import HomePage from "./pages/HomePage";

// Lazy loading: other pages download only when first opened,
// so the first visit stays small and fast.
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const CareerDetailPage = lazy(() => import("./pages/CareerDetailPage"));
const AssessmentsPage = lazy(() => import("./pages/AssessmentsPage"));
const AssessmentTestPage = lazy(() => import("./pages/AssessmentTestPage"));
const AssessmentResultPage = lazy(() => import("./pages/AssessmentResultPage"));

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" key="login" />} />
        <Route path="/register" element={<AuthPage mode="register" key="register" />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/careers/:careerId" element={<CareerDetailPage />} />
        <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
        <Route path="/assessments/:kind" element={<ProtectedRoute><AssessmentTestPage /></ProtectedRoute>} />
        <Route path="/assessments/:kind/result" element={<ProtectedRoute><AssessmentResultPage /></ProtectedRoute>} />
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
