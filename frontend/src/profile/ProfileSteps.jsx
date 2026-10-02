// The six steps of the profile form. Each step receives the form state,
// an `update(path, value)` function, the choice lists (already translated) and current errors.
import { ChipGroup, RatingField, SelectField, TextArea, TextField } from "../components/FormFields";
import { useI18n } from "../i18n";
import {
  RATINGS,
  emptyCertification,
  emptyExperienceItem,
  emptyProject,
  emptySkill,
  isWorkStage,
  stageKind,
} from "./profileForm";

/** Add / remove rows for repeatable sections (skills, projects, ...). `item` is a key: profile.item.<item>. */
function ListEditor({ title, item: itemKey, items, onChange, makeEmpty, max, children }) {
  const { t } = useI18n();
  const itemLabel = t(`profile.item.${itemKey}`);
  const itemInSentence = t(`profile.item.${itemKey}.inSentence`); // "skill" (English needs lower case mid-sentence)
  const setItem = (index, key, value) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="field">
      <h3 className="field__label">{title}</h3>
      <div className="item-list">
        {items.map((item, index) => (
          <div className="item" key={index}>
            <div className="item__head">
              <h4 className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                {itemLabel} {index + 1}
              </h4>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => remove(index)}
                aria-label={t("profile.removeItem", { item: itemInSentence, n: index + 1 })}
              >
                {t("profile.remove")}
              </button>
            </div>
            <div className="form-grid">{children(item, (key, value) => setItem(index, key, value), index)}</div>
          </div>
        ))}
      </div>
      {items.length < max && (
        <div>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => onChange([...items, makeEmpty()])}>
            {t("profile.addItem", { item: itemInSentence })}
          </button>
        </div>
      )}
    </div>
  );
}

export function BasicStep({ form, update, options, errors }) {
  const { t } = useI18n();
  return (
    <div className="form-section">
      <h2>{t("profile.step.basic")}</h2>
      <div className="form-grid">
        <TextField label={t("profile.f.fullName")} required autoComplete="name" value={form.full_name}
          onChange={(v) => update("full_name", v)} error={errors.full_name} maxLength={100} />
        <TextField label={t("profile.f.age")} inputMode="numeric" value={form.age}
          onChange={(v) => update("age", v)} error={errors.age} />
        <TextField label={t("profile.f.location")} hint={t("profile.f.location.hint")} autoComplete="address-level2"
          value={form.location} onChange={(v) => update("location", v)} error={errors.location} maxLength={100} />
      </div>
      <SelectField label={t("profile.f.stage")} required value={form.current_stage}
        onChange={(v) => update("current_stage", v)} options={options.stages}
        placeholder={t("profile.f.stage.placeholder")} error={errors.current_stage}
        hint={t("profile.f.stage.hint")} />
      <TextArea label={t("profile.f.bio")} hint={t("profile.f.bio.hint")} value={form.bio}
        onChange={(v) => update("bio", v)} error={errors.bio} maxLength={1000} />
    </div>
  );
}

export function EducationStep({ form, update, options, errors }) {
  const { t } = useI18n();
  const kind = stageKind(form.current_stage, options);
  const e = form.education;
  const set = (key) => (v) => update(`education.${key}`, v);
  const err = (key) => errors[`education.${key}`];

  return (
    <div className="form-section">
      <h2>{t("profile.step.education")}</h2>
      {kind === "school" ? (
        <div className="form-grid">
          <SelectField label={t("profile.f.stream")} value={e.stream} onChange={set("stream")} options={options.streams}
            error={err("stream")} hint={t("profile.f.stream.hint")} />
          <TextField label={t("profile.f.school")} value={e.institution} onChange={set("institution")}
            error={err("institution")} maxLength={100} />
        </div>
      ) : (
        <div className="form-grid">
          <TextField label={t("profile.f.degree")} hint={t("profile.f.degree.hint")} value={e.degree}
            onChange={set("degree")} error={err("degree")} maxLength={100} />
          <TextField label={t("profile.f.branch")} hint={t("profile.f.branch.hint")} value={e.branch}
            onChange={set("branch")} error={err("branch")} maxLength={100} />
          <TextField label={t("profile.f.institution")} value={e.institution} onChange={set("institution")}
            error={err("institution")} maxLength={100} />
          <TextField label={t("profile.f.yearOfStudy")} inputMode="numeric" hint={t("profile.f.yearOfStudy.hint")}
            value={e.year_of_study} onChange={set("year_of_study")} error={err("year_of_study")} />
          <TextField label={t("profile.f.graduationYear")} inputMode="numeric" hint={t("profile.f.graduationYear.hint")}
            value={e.graduation_year} onChange={set("graduation_year")} error={err("graduation_year")} />
        </div>
      )}
      <div className="form-grid">
        <SelectField label={t("profile.f.scoreType")} value={e.score_type} onChange={set("score_type")}
          options={options.score_types} error={err("score_type")} />
        <TextField label={t("profile.f.score")} inputMode="decimal" hint={t("profile.f.score.hint")} value={e.score}
          onChange={set("score")} error={err("score") || errors.education} />
      </div>
    </div>
  );
}

export function SkillsStep({ form, update, options, errors }) {
  const { t } = useI18n();
  return (
    <div className="form-section">
      <h2>{t("profile.step.skills")}</h2>
      <p className="muted" style={{ margin: 0 }}>{t("profile.skills.lead")}</p>
      <ListEditor title={t("profile.skills.title")} item="skill" items={form.skills} max={100}
        onChange={(v) => update("skills", v)} makeEmpty={emptySkill}>
        {(item, set, i) => (
          <>
            <TextField label={t("profile.item.skill")} value={item.name} onChange={(v) => set("name", v)}
              error={errors[`skills.${i}.name`]} maxLength={60} />
            <SelectField label={t("profile.f.skillType")} value={item.category} onChange={(v) => set("category", v || "other")}
              options={options.skill_categories} />
            <SelectField label={t("profile.f.level")} value={item.level} onChange={(v) => set("level", v || "beginner")}
              options={options.skill_levels} />
          </>
        )}
      </ListEditor>
      <ListEditor title={t("profile.certs.title")} item="certification" items={form.certifications} max={50}
        onChange={(v) => update("certifications", v)} makeEmpty={emptyCertification}>
        {(item, set, i) => (
          <>
            <TextField label={t("profile.f.certName")} value={item.name} onChange={(v) => set("name", v)}
              error={errors[`certifications.${i}.name`]} maxLength={120} />
            <TextField label={t("profile.f.issuer")} value={item.issuer} onChange={(v) => set("issuer", v)} maxLength={100} />
            <TextField label={t("profile.f.year")} inputMode="numeric" value={item.year} onChange={(v) => set("year", v)}
              error={errors[`certifications.${i}.year`]} />
          </>
        )}
      </ListEditor>
    </div>
  );
}

function experienceFields(prefix, errors, t) {
  return function Fields(item, set, i) {
    return (
      <>
        <TextField label={t("profile.f.role")} value={item.title} onChange={(v) => set("title", v)}
          error={errors[`${prefix}.${i}.title`]} maxLength={100} />
        <TextField label={t("profile.f.organization")} value={item.organization}
          onChange={(v) => set("organization", v)} maxLength={100} />
        <TextField label={t("profile.f.months")} inputMode="numeric" value={item.duration_months}
          onChange={(v) => set("duration_months", v)} error={errors[`${prefix}.${i}.duration_months`]} />
        <TextField label={t("profile.f.whatYouDid")} value={item.description}
          onChange={(v) => set("description", v)} maxLength={500} />
      </>
    );
  };
}

export function ExperienceStep({ form, update, options, errors }) {
  const { t } = useI18n();
  const exp = form.experience;
  const work = isWorkStage(form.current_stage, options);
  return (
    <div className="form-section">
      <h2>{t("profile.step.experience")}</h2>
      {work && (
        <div className="form-grid">
          <TextField label={t("profile.f.currentRole")} value={exp.current_role}
            onChange={(v) => update("experience.current_role", v)} error={errors["experience.current_role"]} maxLength={100} />
          <TextField label={t("profile.f.totalYears")} inputMode="decimal" value={exp.total_years}
            onChange={(v) => update("experience.total_years", v)} error={errors["experience.total_years"]} />
        </div>
      )}
      <ListEditor title={t("profile.internships.title")} item="internship" items={exp.internships} max={20}
        onChange={(v) => update("experience.internships", v)} makeEmpty={emptyExperienceItem}>
        {experienceFields("experience.internships", errors, t)}
      </ListEditor>
      <ListEditor title={t("profile.jobs.title")} item="job" items={exp.jobs} max={20}
        onChange={(v) => update("experience.jobs", v)} makeEmpty={emptyExperienceItem}>
        {experienceFields("experience.jobs", errors, t)}
      </ListEditor>
      <ListEditor title={t("profile.projects.title")} item="project" items={exp.projects} max={30}
        onChange={(v) => update("experience.projects", v)} makeEmpty={emptyProject}>
        {(item, set, i) => (
          <>
            <TextField label={t("profile.f.projectTitle")} value={item.title} onChange={(v) => set("title", v)}
              error={errors[`experience.projects.${i}.title`]} maxLength={100} />
            <TextField label={t("profile.f.technologies")} hint={t("profile.commaHint")} value={item.technologies}
              onChange={(v) => set("technologies", v)} error={errors[`experience.projects.${i}.technologies`]} />
            <TextField label={t("profile.f.link")} type="url" hint={t("profile.f.link.hint")} value={item.link}
              onChange={(v) => set("link", v)} error={errors[`experience.projects.${i}.link`]} />
            <TextField label={t("profile.f.shortDescription")} value={item.description}
              onChange={(v) => set("description", v)} maxLength={500} />
          </>
        )}
      </ListEditor>
    </div>
  );
}

export function InterestsStep({ form, update, options, errors }) {
  const { t } = useI18n();
  return (
    <div className="form-section">
      <h2>{t("profile.step.interestsLong")}</h2>
      <ChipGroup legend={t("profile.f.interests")} hint={t("profile.f.interests.hint")} options={options.interests}
        values={form.interests} onChange={(v) => update("interests", v)} error={errors.interests} />
      <ChipGroup legend={t("profile.f.goals")} hint={t("profile.f.goals.hint")} options={options.goals}
        values={form.goals} onChange={(v) => update("goals", v)} error={errors.goals} />
    </div>
  );
}

export function PreferencesStep({ form, update, options, errors }) {
  const { t } = useI18n();
  const p = form.preferences;
  return (
    <div className="form-section">
      <h2>{t("profile.step.preferencesLong")}</h2>
      <div className="form-grid">
        <SelectField label={t("profile.f.workMode")} value={p.work_mode === "any" ? "" : p.work_mode}
          onChange={(v) => update("preferences.work_mode", v || "any")}
          options={options.work_modes.filter((m) => m.value !== "any")} placeholder={t("opt.work_modes.any")} />
        <TextField label={t("profile.f.locations")} hint={t("profile.commaHint")} value={p.preferred_locations}
          onChange={(v) => update("preferences.preferred_locations", v)} error={errors["preferences.preferred_locations"]} />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={p.open_to_relocation}
          onChange={(e) => update("preferences.open_to_relocation", e.target.checked)} />
        <span>{t("profile.f.relocate")}</span>
      </label>
      <p className="muted" style={{ margin: 0 }}>{t("profile.ratings.lead")}</p>
      {RATINGS.map((r) => (
        <RatingField key={r.key} legend={t(`profile.rating.${r.key}`)} lowLabel={t(`profile.rating.${r.key}.low`)}
          highLabel={t(`profile.rating.${r.key}.high`)} value={p[r.key]}
          onChange={(v) => update(`preferences.${r.key}`, v)} />
      ))}
    </div>
  );
}
