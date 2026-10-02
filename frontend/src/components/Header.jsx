import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { NAV_GROUPS, navLabel } from "../navigation";
import Icon from "./Icon";
import LanguagePicker from "./LanguagePicker";
import ThemePicker from "./ThemePicker";

/**
 * App shell navigation.
 * - Desktop (>= 1024px): a fixed sidebar with the brand, grouped links and a user card.
 * - Mobile: a slim top bar; the same <nav> slides in as a drawer with a backdrop.
 * One <nav aria-label="Main"> serves both, so keyboard and screen-reader users
 * always find the menu in the same place.
 */
export default function Header() {
  const [open, setOpen] = useState(false);
  const { status, user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setOpen(false);
    // Leave protected pages first, otherwise they would redirect to /login
    navigate("/", { replace: true });
    await logout();
  };

  // Close the drawer when any link inside it is clicked
  const closeOnLinkClick = (event) => {
    if (event.target.closest("a")) setOpen(false);
  };

  // Close with Escape, and stop the page behind the drawer from scrolling
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("drawer-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("drawer-open");
    };
  }, [open]);

  const initial = (user?.email || "?").charAt(0).toUpperCase();

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="brand" aria-label={t("header.homeLink")} onClick={() => setOpen(false)}>
          <span className="brand__mark" aria-hidden="true">
            <Icon name="compass" size={18} strokeWidth={2} />
          </span>
          <span className="brand__name">Career Compass</span>
        </Link>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? t("header.closeMenu") : t("header.openMenu")}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} size={20} />
        </button>
      </div>

      {/* Backdrop behind the mobile drawer; clicking it closes the menu */}
      <div
        className={open ? "drawer-backdrop drawer-backdrop--open" : "drawer-backdrop"}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <nav id="main-nav" aria-label={t("header.mainNav")} className={open ? "nav nav--open" : "nav"} onClick={closeOnLinkClick}>
        <div className="nav__scroll">
          <NavLink to="/" end className="nav__link nav__link--home">
            <Icon name="compass" />
            <span>{t("nav.home")}</span>
          </NavLink>
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="nav__group" role="group" aria-label={navLabel(t, group)}>
              <span className="nav__group-label" aria-hidden="true">
                {navLabel(t, group)}
              </span>
              <div className="nav__group-links">
                {group.items.map((item) => (
                  <NavLink key={item.path} to={item.path} className="nav__link">
                    <Icon name={item.icon} />
                    <span>{navLabel(t, item)}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="nav__actions">
          <div className="nav__pickers">
            <LanguagePicker />
            <ThemePicker />
          </div>
          {status === "authenticated" ? (
            <div className="user-menu">
              <div className="user-menu__who">
                <span className="user-menu__avatar" aria-hidden="true">
                  {initial}
                </span>
                <span className="user-menu__email" title={user.email}>
                  {user.email}
                </span>
              </div>
              <div className="user-menu__buttons">
                <NavLink to="/profile" className="btn btn--secondary btn--small">
                  <Icon name="user" size={16} />
                  {t("header.myProfile")}
                </NavLink>
                <button type="button" className="btn btn--ghost btn--small" onClick={handleLogout}>
                  <Icon name="logout" size={16} />
                  {t("header.logout")}
                </button>
              </div>
            </div>
          ) : status === "anonymous" ? (
            <div className="user-menu">
              <p className="user-menu__pitch">{t("header.pitch")}</p>
              <div className="user-menu__buttons">
                <Link to="/register" className="btn btn--primary btn--small">
                  {t("header.getStarted")}
                </Link>
                <NavLink to="/login" className="btn btn--secondary btn--small">
                  {t("header.login")}
                </NavLink>
              </div>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
