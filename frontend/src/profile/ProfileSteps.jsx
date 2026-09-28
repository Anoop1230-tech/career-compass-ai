// The six steps of the profile form. Each step receives the form state,
// an `update(path, value)` function, the choice lists and current errors.
import { ChipGroup, RatingField, SelectField, TextArea, TextField } from "../components/FormFields";
import {
  RATINGS,
  emptyCertification,
  emptyExperienceItem,
  emptyProject,
  emptySkill,
  isWorkStage,
  stageKind,
} from "./profileForm";

/** Add / remove rows for repeatable sections (skills, projects, ...). */
function ListEditor({ title, itemLabel, items, onChange, makeEmpty, max, children }) {
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
                aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
              >
                Remove
              </button>
            </div>
            <div className="form-grid">{children(item, (key, value) => setItem(index, key, value), index)}</div>
          </div>
        ))}
      </div>
      {items.length < max && (
        <div>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => onChange([...items, makeEmpty()])}>
            + Add {itemLabel.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  );
}

export function BasicStep({ form, update, options, errors }) {
  return (
    <div className="form-section">
      <h2>About you</h2>
      <div className="form-grid">
        <TextField label="Full name" required autoComplete="name" value={form.full_name}
          onChange={(v) => update("full_name", v)} error={errors.full_name} maxLength={100} />
        <TextField label="Age" inputMode="numeric" value={form.age}
          onChange={(v) => update("age", v)} error={errors.age} />
        <TextField label="Location" hint="City or state" autoComplete="address-level2" value={form.location}
          onChange={(v) => update("location", v)} error={errors.location} maxLength={100} />
      </div>
      <SelectField label="Where are you now?" required value={form.current_stage}
        onChange={(v) => update("current_stage", v)} options={options.stages}
        placeholder="Choose your current stage" error={errors.current_stage}
        hint="This decides which questions we ask and which next steps we suggest." />
      <TextArea label="About me" hint="Anything else that matters for your career decisions." value={form.bio}
        onChange={(v) => update("bio", v)} error={errors.bio} maxLength={1000} />
    </div>
  );
}

export function EducationStep({ form, update, options, errors }) {
  const kind = stageKind(form.current_stage, options);
  const e = form.education;
  const set = (key) => (v) => update(`education.${key}`, v);
  const err = (key) => errors[`education.${key}`];

  return (
    <div className="form-section">
      <h2>Education</h2>
      {kind === "school" ? (
        <div className="form-grid">
          <SelectField label="Stream" value={e.stream} onChange={set("stream")} options={options.streams}
            error={err("stream")} hint="For Class 10, pick the stream you are considering." />
          <TextField label="School" value={e.institution} onChange={set("institution")} error={err("institution")} maxLength={100} />
        </div>
      ) : (
        <div className="form-grid">
          <TextField label="Highest / current degree" hint="e.g. B.Tech, BCA, B.Com, MBA" value={e.degree}
            onChange={set("degree")} error={err("degree")} maxLength={100} />
          <TextField label="Branch / specialization" hint="e.g. Computer Science" value={e.branch}
            onChange={set("branch")} error={err("branch")} maxLength={100} />
          <TextField label="College / university" value={e.institution} onChange={set("institution")}
            error={err("institution")} maxLength={100} />
          <TextField label="Current year of study" inputMode="numeric" hint="Leave empty if completed"
            value={e.year_of_study} onChange={set("year_of_study")} error={err("year_of_study")} />
          <TextField label="Graduation year" inputMode="numeric" hint="Expected or completed"
            value={e.graduation_year} onChange={set("graduation_year")} error={err("graduation_year")} />
        </div>
      )}
      <div className="form-grid">
        <SelectField label="Score type" value={e.score_type} onChange={set("score_type")} options={options.score_types}
          error={err("score_type")} />
        <TextField label="Academic score" inputMode="decimal" hint="Latest percentage or CGPA" value={e.score}
          onChange={set("score")} error={err("score") || errors.education} />
      </div>
    </div>
  );
}

export function SkillsStep({ form, update, options, errors }) {
  return (
    <div className="form-section">
      <h2>Skills</h2>
      <p className="muted" style={{ margin: 0 }}>
        Add what you can already do: programming, tools, communication, management or subject knowledge.
      </p>
      <ListEditor title="Your skills" itemLabel="Skill" items={form.skills} max={100}
        onChange={(v) => update("skills", v)} makeEmpty={emptySkill}>
        {(item, set, i) => (
          <>
            <TextField label="Skill" value={item.name} onChange={(v) => set("name", v)}
              error={errors[`skills.${i}.name`]} maxLength={60} />
            <SelectField label="Type" value={item.category} onChange={(v) => set("category", v || "other")}
              options={options.skill_categories} />
            <SelectField label="Level" value={item.level} onChange={(v) => set("level", v || "beginner")}
              options={options.skill_levels} />
          </>
        )}
      </ListEditor>
      <ListEditor title="Certifications" itemLabel="Certification" items={form.certifications} max={50}
        onChange={(v) => update("certifications", v)} makeEmpty={emptyCertification}>
        {(item, set, i) => (
          <>
            <TextField label="Name" value={item.name} onChange={(v) => set("name", v)}
              error={errors[`certifications.${i}.name`]} maxLength={120} />
            <TextField label="Issued by" value={item.issuer} onChange={(v) => set("issuer", v)} maxLength={100} />
            <TextField label="Year" inputMode="numeric" value={item.year} onChange={(v) => set("year", v)}
              error={errors[`certifications.${i}.year`]} />
          </>
        )}
      </ListEditor>
    </div>
  );
}

function experienceFields(prefix, errors) {
  return function Fields(item, set, i) {
    return (
      <>
        <TextField label="Role / title" value={item.title} onChange={(v) => set("title", v)}
          error={errors[`${prefix}.${i}.title`]} maxLength={100} />
        <TextField label="Organization" value={item.organization} onChange={(v) => set("organization", v)} maxLength={100} />
        <TextField label="Duration (months)" inputMode="numeric" value={item.duration_months}
          onChange={(v) => set("duration_months", v)} error={errors[`${prefix}.${i}.duration_months`]} />
        <TextField label="What you did" value={item.description} onChange={(v) => set("description", v)} maxLength={500} />
      </>
    );
  };
}

export function ExperienceStep({ form, update, options, errors }) {
  const exp = form.experience;
  const work = isWorkStage(form.current_stage, options);
  return (
    <div className="form-section">
      <h2>Experience</h2>
      {work && (
        <div className="form-grid">
          <TextField label="Current job role" value={exp.current_role}
            onChange={(v) => update("experience.current_role", v)} error={errors["experience.current_role"]} maxLength={100} />
          <TextField label="Total work experience (years)" inputMode="decimal" value={exp.total_years}
            onChange={(v) => update("experience.total_years", v)} error={errors["experience.total_years"]} />
        </div>
      )}
      <ListEditor title="Internships" itemLabel="Internship" items={exp.internships} max={20}
        onChange={(v) => update("experience.internships", v)} makeEmpty={emptyExperienceItem}>
        {experienceFields("experience.internships", errors)}
      </ListEditor>
      <ListEditor title="Jobs" itemLabel="Job" items={exp.jobs} max={20}
        onChange={(v) => update("experience.jobs", v)} makeEmpty={emptyExperienceItem}>
        {experienceFields("experience.jobs", errors)}
      </ListEditor>
      <ListEditor title="Projects" itemLabel="Project" items={exp.projects} max={30}
        onChange={(v) => update("experience.projects", v)} makeEmpty={emptyProject}>
        {(item, set, i) => (
          <>
            <TextField label="Project title" value={item.title} onChange={(v) => set("title", v)}
              error={errors[`experience.projects.${i}.title`]} maxLength={100} />
            <TextField label="Technologies" hint="Separate with commas" value={item.technologies}
              onChange={(v) => set("technologies", v)} error={errors[`experience.projects.${i}.technologies`]} />
            <TextField label="Link" type="url" hint="GitHub or live demo" value={item.link}
              onChange={(v) => set("link", v)} error={errors[`experience.projects.${i}.link`]} />
            <TextField label="Short description" value={item.description} onChange={(v) => set("description", v)} maxLength={500} />
          </>
        )}
      </ListEditor>
    </div>
  );
}

export function InterestsStep({ form, update, options, errors }) {
  return (
    <div className="form-section">
      <h2>Interests and goals</h2>
      <ChipGroup legend="Which areas interest you?" hint="Pick as many as you like." options={options.interests}
        values={form.interests} onChange={(v) => update("interests", v)} error={errors.interests} />
      <ChipGroup legend="What do you want next?" hint="Your goals shape which paths we rank first." options={options.goals}
        values={form.goals} onChange={(v) => update("goals", v)} error={errors.goals} />
    </div>
  );
}

export function PreferencesStep({ form, update, options, errors }) {
  const p = form.preferences;
  return (
    <div className="form-section">
      <h2>Work preferences</h2>
      <div className="form-grid">
        <SelectField label="Preferred work mode" value={p.work_mode === "any" ? "" : p.work_mode}
          onChange={(v) => update("preferences.work_mode", v || "any")}
          options={options.work_modes.filter((m) => m.value !== "any")} placeholder="No preference" />
        <TextField label="Preferred locations" hint="Separate with commas" value={p.preferred_locations}
          onChange={(v) => update("preferences.preferred_locations", v)} error={errors["preferences.preferred_locations"]} />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={p.open_to_relocation}
          onChange={(e) => update("preferences.open_to_relocation", e.target.checked)} />
        <span>I am open to relocating</span>
      </label>
      <p className="muted" style={{ margin: 0 }}>
        Rate yourself from 1 to 5. These are estimates; the assessments in a later phase measure them properly.
      </p>
      {RATINGS.map((r) => (
        <RatingField key={r.key} legend={r.label} lowLabel={r.low} highLabel={r.high} value={p[r.key]}
          onChange={(v) => update(`preferences.${r.key}`, v)} />
      ))}
    </div>
  );
}
