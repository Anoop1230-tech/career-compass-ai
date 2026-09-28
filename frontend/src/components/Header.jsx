import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../navigation";

export default function Header() {
  const [open, setOpen] = useState(false);

  // Close the mobile menu when any link inside it is clicked
  const closeOnLinkClick = (event) => {
    if (event.target.closest("a")) setOpen(false);
  };

  // Close the mobile menu with the Escape key
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="brand" aria-label="Career Compass AI home" onClick={() => setOpen(false)}>
          <span className="brand__mark" aria-hidden="true">CC</span>
          <span>Career Compass</span>
        </Link>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            {open ? (
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <nav
          id="main-nav"
          aria-label="Main"
          className={open ? "nav nav--open" : "nav"}
          onClick={closeOnLinkClick}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} className="nav__link">
              {item.label}
            </NavLink>
          ))}
          <div className="nav__actions">
            <Link to="/profile" className="btn btn--primary btn--small">
              Get started
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
