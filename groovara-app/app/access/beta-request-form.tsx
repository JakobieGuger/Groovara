"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import ThemeToggle from "@/lib/ThemeToggle";
import { trackEvent } from "@/lib/analytics";

type BetaRequestFormProps = {
  turnstileSiteKey: string;
};

type FormErrors = Partial<
  Record<
    | "name"
    | "email"
    | "lifeDecade"
    | "collectionHistory"
    | "collectionGoals"
    | "musicServices"
    | "form",
    string
  >
>;

const decadeOptions = [
  "Under 18",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55–64",
  "65+",
];

const collectionHistoryOptions = [
  "Streaming playlists",
  "CDs or vinyl",
  "Downloaded music files",
  "Mixtapes or mix CDs",
  "I mostly listen without organizing",
];

const collectionGoalOptions = [
  "Share music more thoughtfully",
  "Build gifts or listening experiences",
  "Keep music memories in one place",
  "Organize songs across platforms",
  "Discover what friends care about",
  "Other",
];

const musicServiceOptions = ["Spotify", "YouTube", "Apple Music", "Other"];

export function BetaRequestForm({
  turnstileSiteKey,
}: BetaRequestFormProps) {
  const [musicMeaning, setMusicMeaning] = useState(7);
  const [activeSection, setActiveSection] = useState("about");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const sectionLinks = useMemo(
    () => [
      { id: "about", number: "01", label: "About you" },
      { id: "listening", number: "02", label: "Your listening" },
      { id: "intent", number: "03", label: "Why Groovara" },
    ],
    [],
  );

  function jumpToSection(sectionId: string) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const lifeDecade = String(formData.get("lifeDecade") ?? "").trim();
    const collectionHistory = formData
      .getAll("collectionHistory")
      .map(String);
    const collectionGoals = formData.getAll("collectionGoals").map(String);
    const musicServices = formData.getAll("musicServices").map(String);
    const collectionGoalOther = String(
      formData.get("collectionGoalOther") ?? "",
    ).trim();
    const musicServiceOther = String(
      formData.get("musicServiceOther") ?? "",
    ).trim();
    const meaningfulStory = String(
      formData.get("meaningfulStory") ?? "",
    ).trim();
    const website = String(formData.get("website") ?? "").trim();
    const turnstileToken = String(
      formData.get("cf-turnstile-response") ?? "",
    );

    const nextErrors: FormErrors = {};

    if (!name) nextErrors.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!lifeDecade) nextErrors.lifeDecade = "Choose an age range.";
    if (collectionHistory.length === 0) {
      nextErrors.collectionHistory = "Choose at least one answer.";
    }
    if (collectionGoals.length === 0) {
      nextErrors.collectionGoals = "Choose at least one goal.";
    }
    if (musicServices.length === 0) {
      nextErrors.musicServices = "Choose at least one music service.";
    }
    if (turnstileSiteKey && !turnstileToken) {
      nextErrors.form = "Please complete the anti-spam check.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = form.querySelector<HTMLElement>("[aria-invalid='true']");
      firstInvalid?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("access/api/beta-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          lifeDecade,
          musicMeaning,
          collectionHistory,
          collectionGoals,
          collectionGoalOther,
          musicServices,
          musicServiceOther,
          meaningfulStory,
          website,
          turnstileToken,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setErrors({
          form: result?.error ?? "We couldn't submit your request. Try again.",
        });
        trackEvent("beta_access_request_failed", {
          status_code: response.status,
        });
        return;
      }

      setSubmitted(true);
      trackEvent("beta_access_request_submitted", {
        music_meaning: musicMeaning,
        service_count: musicServices.length,
        goal_count: collectionGoals.length,
      });
    } catch {
      setErrors({
        form: "We couldn't reach Groovara. Check your connection and try again.",
      });
      trackEvent("beta_access_request_failed", {
        status_code: 0,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="access-page access-success-page">
        <div aria-hidden="true" className="access-ring access-ring-hero" />

        <AccessHeader />

        <section className="access-success-panel" aria-live="polite">
          <p className="access-eyebrow">Request received</p>
          <h1>Your note is in the listening room.</h1>
          <p>
            Thanks for taking the time to tell us how music fits into your life.
            We&apos;ll review your request and contact you at the email you
            provided if a beta place opens up.
          </p>
          <div className="access-success-actions">
            <Link className="access-primary-button" href="/">
              Return home
            </Link>
            <Link className="access-secondary-button" href="/login">
              Already have access? Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="access-page">
      <div aria-hidden="true" className="access-ring access-ring-hero" />
      <div aria-hidden="true" className="access-ring access-ring-left" />
      <div aria-hidden="true" className="access-ring access-ring-footer" />

      <AccessHeader />

      <section className="access-hero">
        <p className="access-eyebrow">Private beta</p>
        <h1>Help shape a more thoughtful way to share music.</h1>
        <div className="access-hero-copy">
          <p>
            Groovara turns a list of songs into a paced listening experience:
            one that can carry notes, memories, and a little anticipation.
          </p>
          <p>
            We&apos;re inviting a small group of listeners to try it early and
            tell us what feels meaningful, confusing, or missing.
          </p>
        </div>
      </section>

      <nav className="access-progress-nav" aria-label="Application sections">
        {sectionLinks.map((section) => (
          <button
            className={activeSection === section.id ? "active" : ""}
            key={section.id}
            type="button"
            onClick={() => jumpToSection(section.id)}
          >
            <span>{section.number}</span>
            {section.label}
          </button>
        ))}
      </nav>

      <form className="access-form" onSubmit={handleSubmit} noValidate>
        <p className="access-required-note">
          <span>*</span> Required
        </p>

        <section className="access-form-section" id="about">
          <div className="access-section-heading">
            <p className="access-section-kicker">01 · About you</p>
            <h2>A little context helps us build for actual listeners.</h2>
          </div>

          <div>
            <div className="access-field-grid">
              <label className="access-text-field">
                <span>
                  Name <b>*</b>
                </span>
                <input
                  aria-invalid={Boolean(errors.name)}
                  autoComplete="name"
                  name="name"
                  type="text"
                />
                {errors.name ? (
                  <small className="access-field-error">{errors.name}</small>
                ) : null}
              </label>

              <label className="access-text-field">
                <span>
                  Email <b>*</b>
                </span>
                <input
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                  name="email"
                  type="email"
                />
                {errors.email ? (
                  <small className="access-field-error">{errors.email}</small>
                ) : null}
              </label>
            </div>

            <fieldset className="access-question-block">
              <legend>
                What stage of life are you in? <span>*</span>
              </legend>
              <p className="access-question-helper">
                This is used only to understand whether the beta reflects a
                useful range of listeners.
              </p>
              <div className="access-choice-grid access-choice-grid-compact">
                {decadeOptions.map((option) => (
                  <label className="access-choice-row" key={option}>
                    <input
                      aria-invalid={Boolean(errors.lifeDecade)}
                      name="lifeDecade"
                      type="radio"
                      value={option}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {errors.lifeDecade ? (
                <small className="access-field-error">
                  {errors.lifeDecade}
                </small>
              ) : null}
            </fieldset>
          </div>
        </section>

        <section className="access-form-section" id="listening">
          <div className="access-section-heading">
            <p className="access-section-kicker">02 · Your listening</p>
            <h2>How music already lives in your routines and collections.</h2>
          </div>

          <div>
            <fieldset className="access-question-block">
              <legend>How meaningful is music in your day-to-day life?</legend>
              <div className="access-range-answer">
                <div className="access-range-label-row">
                  <p>Something I enjoy in the background</p>
                  <output htmlFor="musicMeaning">{musicMeaning}</output>
                  <p>A major part of how I remember and connect</p>
                </div>
                <div className="access-range-control">
                  <input
                    id="musicMeaning"
                    max="10"
                    min="1"
                    name="musicMeaning"
                    type="range"
                    value={musicMeaning}
                    onChange={(event) =>
                      setMusicMeaning(Number(event.target.value))
                    }
                  />
                  <div className="access-range-numbers" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, index) => (
                      <span key={index + 1}>{index + 1}</span>
                    ))}
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="access-question-block">
              <legend>
                How have you kept or organized music before? <span>*</span>
              </legend>
              <div className="access-choice-grid">
                {collectionHistoryOptions.map((option) => (
                  <label className="access-choice-row" key={option}>
                    <input
                      aria-invalid={Boolean(errors.collectionHistory)}
                      name="collectionHistory"
                      type="checkbox"
                      value={option}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {errors.collectionHistory ? (
                <small className="access-field-error">
                  {errors.collectionHistory}
                </small>
              ) : null}
            </fieldset>

            <fieldset className="access-question-block">
              <legend>
                Which services do you currently use? <span>*</span>
              </legend>
              <div className="access-choice-grid">
                {musicServiceOptions.map((option) =>
                  option === "Other" ? (
                    <div className="access-choice-row access-choice-with-input" key={option}>
                      <label>
                        <input
                          aria-invalid={Boolean(errors.musicServices)}
                          name="musicServices"
                          type="checkbox"
                          value={option}
                        />
                        <span>{option}</span>
                      </label>
                      <input
                        aria-label="Other music service"
                        className="access-inline-input"
                        name="musicServiceOther"
                        placeholder="Bandcamp, SoundCloud, local files…"
                        type="text"
                      />
                    </div>
                  ) : (
                    <label className="access-choice-row" key={option}>
                      <input
                        aria-invalid={Boolean(errors.musicServices)}
                        name="musicServices"
                        type="checkbox"
                        value={option}
                      />
                      <span>{option}</span>
                    </label>
                  ),
                )}
              </div>
              {errors.musicServices ? (
                <small className="access-field-error">
                  {errors.musicServices}
                </small>
              ) : null}
            </fieldset>
          </div>
        </section>

        <section className="access-form-section" id="intent">
          <div className="access-section-heading">
            <p className="access-section-kicker">03 · Why Groovara</p>
            <h2>What would make this feel worth returning to?</h2>
          </div>

          <div>
            <fieldset className="access-question-block">
              <legend>
                What would you most like to use Groovara for? <span>*</span>
              </legend>
              <div className="access-choice-grid">
                {collectionGoalOptions.map((option) =>
                  option === "Other" ? (
                    <div className="access-choice-row access-choice-with-input" key={option}>
                      <label>
                        <input
                          aria-invalid={Boolean(errors.collectionGoals)}
                          name="collectionGoals"
                          type="checkbox"
                          value={option}
                        />
                        <span>{option}</span>
                      </label>
                      <input
                        aria-label="Other Groovara goal"
                        className="access-inline-input"
                        name="collectionGoalOther"
                        placeholder="Something else…"
                        type="text"
                      />
                    </div>
                  ) : (
                    <label className="access-choice-row" key={option}>
                      <input
                        aria-invalid={Boolean(errors.collectionGoals)}
                        name="collectionGoals"
                        type="checkbox"
                        value={option}
                      />
                      <span>{option}</span>
                    </label>
                  ),
                )}
              </div>
              {errors.collectionGoals ? (
                <small className="access-field-error">
                  {errors.collectionGoals}
                </small>
              ) : null}
            </fieldset>

            <label className="access-text-field access-textarea-field">
              <span>Tell us about a song, playlist, or mix that mattered to you.</span>
              <p className="access-question-helper">
                Optional, but this is often the most useful answer in the whole
                request.
              </p>
              <textarea
                maxLength={2000}
                name="meaningfulStory"
                placeholder="A few sentences is plenty."
              />
            </label>

            <label className="access-hp-field" aria-hidden="true">
              Website
              <input autoComplete="off" name="website" tabIndex={-1} type="text" />
            </label>

            {turnstileSiteKey ? (
              <div
                className="cf-turnstile"
                data-sitekey={turnstileSiteKey}
                data-theme="auto"
              />
            ) : null}

            {errors.form ? (
              <p className="access-form-error" role="alert">
                {errors.form}
              </p>
            ) : null}

            <div className="access-submit-row">
              <button
                className="access-primary-button"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Sending request…" : "Request beta access"}
              </button>
            </div>
          </div>
        </section>
      </form>
    </main>
  );
}

function AccessHeader() {
  return (
    <header className="access-header" aria-label="Groovara beta access">
      <Link className="access-brand" href="/">
        <span className="access-logo-wrap">
          <Image
            alt=""
            aria-hidden="true"
            height={24}
            priority
            src="/groovara-icon-v2.png"
            width={24}
          />
        </span>
        <span>GROOVARA</span>
      </Link>

      <div className="access-header-actions">
        <Link className="access-header-link" href="/login">
          Sign in
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
