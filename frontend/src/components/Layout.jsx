import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useScrollReveal from "../hooks/useScrollReveal";
import { useI18n } from "../i18n";
import ErrorBoundary from "./ErrorBoundary";
import Footer from "./Footer";
import Header from "./Header";

function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="page-center" role="status" aria-label={t("layout.loadingPage")}>
      <div className="loader" />
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { loggedOut, clearLoggedOut } = useAuth();
  const { t } = useI18n();
  const mainRef = useRef(null);
  useScrollReveal(mainRef, pathname);

  // Start each new page at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Logging out lands on home; after that, protected pages ask for login again
  useEffect(() => {
    if (loggedOut && pathname === "/") clearLoggedOut();
  }, [loggedOut, pathname, clearLoggedOut]);

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {t("layout.skip")}
      </a>
      <Header />
      <div className="app__body">
        <main id="main" className="main" tabIndex={-1} ref={mainRef}>
          {/* key={pathname}: a new page remounts, which resets a crashed page
              and replays the short entrance animation (.page-enter) */}
          <ErrorBoundary key={pathname}>
            <div className="page-enter">
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </div>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  );
}
