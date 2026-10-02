import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
// Home is the landing page: load it immediately so the first paint has content.
import HomePage from "./pages/HomePage";

// Lazy loading: other pages download only when first opened,
// so the first visit stays small and fast.
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage"));
const ResumePage = lazy(() => import("./pages/ResumePage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const CareerDetailPage = lazy(() => import("./pages/CareerDetailPage"));
const AssessmentsPage = lazy(() => import("./pages/AssessmentsPage"));
const AssessmentTestPage = lazy(() => import("./pages/AssessmentTestPage"));
const AssessmentResultPage = lazy(() => import("./pages/AssessmentResultPage"));
const NextStepsPage = lazy(() => import("./pages/NextStepsPage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const SkillGapPage = lazy(() => import("./pages/SkillGapPage"));
const DreamCheckPage = lazy(() => import("./pages/DreamCheckPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const PredictorPage = lazy(() => import("./pages/PredictorPage"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const MentorPage = lazy(() => import("./pages/MentorPage"));
const ForgotPasswordPage = lazy(() => import("./pages/PasswordResetPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/PasswordResetPages").then((m) => ({ default: m.ResetPasswordPage })));

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" key="login" />} />
        <Route path="/register" element={<AuthPage mode="register" key="register" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
        <Route path="/profile/resume" element={<ProtectedRoute><ResumePage /></ProtectedRoute>} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/careers/:careerId" element={<CareerDetailPage />} />
        <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
        <Route path="/assessments/:kind" element={<ProtectedRoute><AssessmentTestPage /></ProtectedRoute>} />
        <Route path="/assessments/:kind/result" element={<ProtectedRoute><AssessmentResultPage /></ProtectedRoute>} />
        <Route path="/next-steps" element={<NextStepsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/mentor" element={<ProtectedRoute><MentorPage /></ProtectedRoute>} />
        <Route path="/dream-check" element={<DreamCheckPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/college-predictor" element={<PredictorPage />} />
        <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
        <Route path="/skill-gap" element={<ProtectedRoute><SkillGapPage /></ProtectedRoute>} />
        <Route path="/for-you" element={<ProtectedRoute><RecommendationsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
