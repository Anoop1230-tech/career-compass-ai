import { Link } from "react-router-dom";
import HeroIllustration from "../components/HeroIllustration";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { NAV_GROUPS, navLabel, navText } from "../navigation";

// Texts for these lists live in i18n/*.js under home.stage.<key> / home.creative.<key> / home.journey.<key>
const STAGES = [
  { key: "class10", to: "/next-steps?stage=EDU_CLASS_10", icon: "book" },
  { key: "class12", to: "/next-steps?stage=EDU_12_PCM", icon: "clipboard" },
  { key: "diploma", to: "/next-steps?stage=EDU_DIPLOMA_CS", icon: "steps" },
  { key: "ug", to: "/next-steps?stage=EDU_BTECH_CSE", icon: "school" },
  { key: "graduate", to: "/next-steps?stage=EDU_BCA", icon: "briefcase" },
  { key: "pg", to: "/next-steps?stage=EDU_MTECH_CSE", icon: "spark" },
  { key: "working", to: "/next-steps?stage=EDU_WORKING_TECH", icon: "star" },
  { key: "changer", to: "/dream-check", icon: "target" },
];

// Careers that need talent, practice and a portfolio rather than a degree
const CREATIVE = [
  { key: "music", to: "/careers?q=Music", icon: "music" },
  { key: "dance", to: "/careers?q=Dance", icon: "dance" },
  { key: "design", to: "/careers?domain=Creative+Arts&q=Design", icon: "palette" },
  { key: "writing", to: "/careers?q=Writing", icon: "pen" },
  { key: "acting", to: "/careers?q=Performing+Arts", icon: "mic" },
  { key: "film", to: "/careers?q=Film+and+Media", icon: "camera" },
  { key: "vocational", to: "/careers?domain=Vocational", icon: "heart" },
];

// The four-step journey, shown in "How it works"
const JOURNEY = [
  { key: "profile", icon: "user" },
  { key: "tests", icon: "clipboard" },
  { key: "matches", icon: "star" },
  { key: "roadmap", icon: "map" },
];

function CardGrid({ items, prefix, warm, t, extra }) {
  return (
    <ul className="stage-grid">
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to} className="stage-card">
            <span className={warm ? "icon-tile icon-tile--warm" : "icon-tile"}>
              <Icon name={item.icon} />
            </span>
            <span>
              <strong>{t(`${prefix}.${item.key}`)}</strong>
              <span className="muted">{t(`${prefix}.${item.key}.hint`)}</span>
            </span>
            <Icon name="arrow" size={18} className="icon stage-card__go" />
          </Link>
        </li>
      ))}
      {extra}
    </ul>
  );
}

export default function HomePage() {
  const { status } = useAuth();
  const { t } = useI18n();
  const loggedIn = status === "authenticated";

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <p className="hero__eyebrow">
              <Icon name="compass" size={16} />
              {t("home.eyebrow")}
            </p>
            <h1>
              {t("home.title.start")} <em>{t("home.title.end")}</em>
            </h1>
            <p className="hero__lead">{t("home.lead")}</p>
            <div className="btn-row">
              <Link to="/next-steps" className="btn btn--primary">
                {t("home.findNext")}
                <Icon name="arrow" size={18} className="icon icon-arrow" />
              </Link>
              {loggedIn ? (
                <Link to="/dashboard" className="btn btn--secondary">{t("home.goDashboard")}</Link>
              ) : (
                <Link to="/register" className="btn btn--secondary">{t("home.createProfile")}</Link>
              )}
            </div>
            <ul className="hero__trust">
              {["free", "noSignup", "official"].map((key) => (
                <li key={key}>
                  <Icon name="check" size={16} />
                  {t(`home.trust.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <figure className="hero-art">
            <HeroIllustration />
          </figure>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="stages-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="stages-title">{t("home.stages.title")}</h2>
            <p className="muted">{t("home.stages.text")}</p>
          </div>
          <CardGrid items={STAGES} prefix="home.stage" t={t} />
        </div>
      </section>

      <section className="section" aria-labelledby="creative-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="creative-title">{t("home.creative.title")}</h2>
            <p className="muted">{t("home.creative.text")}</p>
          </div>
          <CardGrid items={CREATIVE} prefix="home.creative" warm t={t} extra={
            <li>
              <Link to="/next-steps" className="stage-card">
                <span className="icon-tile">
                  <Icon name="steps" />
                </span>
                <span>
                  <strong>{t("home.creative.all")}</strong>
                  <span className="muted">{t("home.creative.all.hint")}</span>
                </span>
                <Icon name="arrow" size={18} className="icon stage-card__go" />
              </Link>
            </li>
          } />
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="how-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="how-title">{t("home.how.title")}</h2>
            <p className="muted">{t("home.how.text")}</p>
          </div>
          <ol className="steps">
            {JOURNEY.map((step) => (
              <li key={step.key}>
                <h3>{t(`home.journey.${step.key}`)}</h3>
                <p className="muted">{t(`home.journey.${step.key}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="features-title">
        <div className="container">
          <div className="section__intro">
            <h2 id="features-title">{t("home.features.title")}</h2>
            <p className="muted">{t("home.features.text")}</p>
          </div>
          <div className="feature-groups">
            {NAV_GROUPS.map((group, g) => (
              <article key={group.key} className="card feature-group">
                <div className="feature-group__head">
                  <h3>{navLabel(t, group)}</h3>
                  <p className="muted">{navText(t, group)}</p>
                </div>
                <ul className="feature-list">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <Link to={item.path} className="feature-link">
                        <span className={g === 1 ? "icon-tile icon-tile--warm" : "icon-tile"}>
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span>
                          <strong>{navLabel(t, item)}</strong>
                          <span className="muted">{navText(t, item)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-title">
        <div className="container">
          <div className="cta-band">
            <div>
              <h2 id="cta-title">{t("home.cta.title")}</h2>
              <p>{t("home.cta.text")}</p>
            </div>
            <div className="btn-row">
              <Link to={loggedIn ? "/dashboard" : "/register"} className="btn btn--primary">
                {loggedIn ? t("home.cta.dashboard") : t("home.cta.start")}
              </Link>
              <Link to="/careers" className="btn btn--secondary">{t("home.cta.browse")}</Link>
            </div>
          </div>
          <p className="notice small" style={{ marginTop: "var(--space-6)" }}>{t("home.disclaimer")}</p>
        </div>
      </section>
    </>
  );
}
