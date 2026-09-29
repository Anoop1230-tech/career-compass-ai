import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import Footer from "./Footer";
import Header from "./Header";

function PageLoader() {
  return (
    <div className="page-center" role="status" aria-label="Loading page">
      <div className="loader" />
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { loggedOut, clearLoggedOut } = useAuth();

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
        Skip to content
      </a>
      <Header />
      <div className="app__body">
        <main id="main" className="main" tabIndex={-1}>
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
