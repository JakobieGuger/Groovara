"use client";

import Image from "next/image";
import Link from "next/link";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useState } from "react";
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
    | "listeningStyle"
    | "collectionHistory"
    | "musicServices"
    | "sharingReason"
    | "form",
    string
  >
>;

const sectionLinks = [
  { id: "about", number: "01", label: "About you" },
  { id: "listening", number: "02", label: "Your listening" },
  { id: "intent", number: "03", label: "Why Groovara" },
];

const decadeOptions = [
  "Under 18",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55–64",
  "65+",
];

const listeningStyleOptions = [
  "Music is usually in the background while I do other things.",
  "I have playlists for almost everything.",
  "Certain songs are tied to specific people or memories.",
  "I often share songs because they say something I can’t.",
  "Music is one of the ways I understand myself.",
];

const collectionHistoryOptions = [
  "Streaming playlists",
  "CDs or vinyl",
  "Downloaded music files",
  "Mixtapes or mix CDs",
  "I mostly listen without organizing",
];

const musicServiceOptions = ["Spotify", "YouTube", "Apple Music", "Other"];

const sharingReasonOptions = [
  "I think they’ll enjoy it",
  "It reminds me of them",
  "It says something I don’t know how to put into words",
  "I want us to experience it together",
  "I don’t really share music very often",
];

export function BetaRequestForm({
  turnstileSiteKey,
}: BetaRequestFormProps) {
  const [activeSection, setActiveSection] = useState("about");
  const [selectedListeningStyles, setSelectedListeningStyles] = useState<
    string[]
  >([]);
  const [selectedSharingReasons, setSelectedSharingReasons] = useState<
    string[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const sections = sectionLinks
      .map((section) => document.getElementById(section.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-22% 0px -58% 0px",
        threshold: [0.08, 0.2, 0.45],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  function jumpToSection(sectionId: string) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function toggleLimitedAnswer(
    option: string,
    selected: string[],
    setSelected: Dispatch<SetStateAction<string[]>>,
  ) {
    setSelected((current) => {
      if (current.includes(option)) {
        return current.filter((value) => value !== option);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, option];
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
    const listeningStyles = formData
      .getAll("listeningStyle")
      .map(String);
    const collectionHistory = formData
      .getAll("collectionHistory")
      .map(String);
    const musicServices = formData.getAll("musicServices").map(String);
    const musicServiceOther = String(
      formData.get("musicServiceOther") ?? "",
    ).trim();
    const sharingReasons = formData
      .getAll("sharingReason")
      .map(String);
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
    if (
      listeningStyles.length === 0 ||
      listeningStyles.length > 3
    ) {
      nextErrors.listeningStyle =
        "Choose between one and three answers.";
    }
    if (collectionHistory.length === 0) {
      nextErrors.collectionHistory = "Choose at least one answer.";
    }
    if (musicServices.length === 0) {
      nextErrors.musicServices = "Choose at least one music service.";
    }
    if (
      sharingReasons.length === 0 ||
      sharingReasons.length > 3
    ) {
      nextErrors.sharingReason =
        "Choose between one and three answers.";
    }
    if (turnstileSiteKey && !turnstileToken) {
      nextErrors.form = "Please complete the anti-spam check.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid =
        form.querySelector<HTMLElement>("[aria-invalid='true']");
      firstInvalid?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      /*
        The current API stores `collectionGoals` and a numeric
        `musicMeaning`. Until that endpoint gets its own schema migration,
        preserve both new qualitative answers as clearly labeled values in
        `collectionGoals` and retain the old form's default numeric value.
      */
      const collectionGoals = [
        ...listeningStyles.map(
          (answer) => `Listening style — ${answer}`,
        ),
        ...sharingReasons.map(
          (answer) => `Sharing reason — ${answer}`,
        ),
      ];

      const response = await fetch("/access/api/beta-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          lifeDecade,
          musicMeaning: 7,
          collectionHistory,
          collectionGoals,
          collectionGoalOther: "",
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
          form: result?.error ?? "We couldn’t submit your request. Try again.",
        });
        trackEvent("beta_access_request_failed", {
          status_code: response.status,
        });
        return;
      }

      setSubmitted(true);
      trackEvent("beta_access_request_submitted", {
        service_count: musicServices.length,
        history_count: collectionHistory.length,
        listening_style_count: listeningStyles.length,
        sharing_reason_count: sharingReasons.length,
        has_story: meaningfulStory.length > 0,
      });
    } catch {
      setErrors({
        form:
          "We couldn’t reach Groovara. Check your connection and try again.",
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
      <main className="access-page access-request-v2 access-success-page">
        <div aria-hidden="true" className="access-ring access-ring-hero" />
        <AccessHeader />

        <section className="access-success-panel" aria-live="polite">
          <p className="access-eyebrow">Request received</p>
          <h1>Your note is in the listening room.</h1>
          <p>
            Thank you for taking the time to tell us how music fits into your
            life. We’ll review your request and in the meantime, don’t keep great songs to yourself.
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
    <main className="access-page access-request-v2">
      <div aria-hidden="true" className="access-ring access-ring-hero" />
      <div aria-hidden="true" className="access-ring access-ring-left" />
      <div aria-hidden="true" className="access-ring access-ring-footer" />

      <div className="access-request-shell">
        <AccessHeader />

        <section className="access-hero">
          <h1>Help us build a better way to share music.</h1>

          <div className="access-hero-copy">
            <p>
              A Mixlist is a new way to share songs. Instead of sending a
              playlist all at once, it unfolds one song at a time, in the
              order you chose, with the story behind each one.
            </p>

            <p>
              Every great Mixlist begins with one person thinking about
              another. That’s the kind of place we’re trying to build. We’re
              building this with those who already communicate with music,
              not focus groups.
            </p>

            <p>
              We’ll be inviting people in through small beta waves. If you’d
              like to help shape what’s next, tell us a little about yourself
              below.
            </p>
          </div>
        </section>

        <nav
          className="access-progress-nav"
          aria-label="Application sections"
        >
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
                    <small className="access-field-error">
                      {errors.name}
                    </small>
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
                    <small className="access-field-error">
                      {errors.email}
                    </small>
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
              <h2>
                How music already lives in your routines and collections.
              </h2>
            </div>

            <div>
              <fieldset className="access-question-block">
                <legend>
                  Which of these sounds most like you? <span>*</span>
                </legend>

                <p className="access-question-helper">
                  Choose up to three answers.
                </p>

                <div className="access-statement-list">
                  {listeningStyleOptions.map((option) => {
                    const isChecked =
                      selectedListeningStyles.includes(option);
                    const isDisabled =
                      !isChecked &&
                      selectedListeningStyles.length >= 3;

                    return (
                      <label
                        className="access-statement-option"
                        key={option}
                      >
                        <input
                          aria-invalid={Boolean(errors.listeningStyle)}
                          checked={isChecked}
                          disabled={isDisabled}
                          name="listeningStyle"
                          onChange={() =>
                            toggleLimitedAnswer(
                              option,
                              selectedListeningStyles,
                              setSelectedListeningStyles,
                            )
                          }
                          type="checkbox"
                          value={option}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>

                {errors.listeningStyle ? (
                  <small className="access-field-error">
                    {errors.listeningStyle}
                  </small>
                ) : null}
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
                      <div
                        className="access-choice-row access-choice-with-input"
                        key={option}
                      >
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
                  When you share a song with someone, it’s usually because…
                  <span>*</span>
                </legend>

                <p className="access-question-helper">
                  Choose up to three answers.
                </p>

                <div className="access-statement-list">
                  {sharingReasonOptions.map((option) => {
                    const isChecked =
                      selectedSharingReasons.includes(option);
                    const isDisabled =
                      !isChecked &&
                      selectedSharingReasons.length >= 3;

                    return (
                      <label
                        className="access-statement-option"
                        key={option}
                      >
                        <input
                          aria-invalid={Boolean(errors.sharingReason)}
                          checked={isChecked}
                          disabled={isDisabled}
                          name="sharingReason"
                          onChange={() =>
                            toggleLimitedAnswer(
                              option,
                              selectedSharingReasons,
                              setSelectedSharingReasons,
                            )
                          }
                          type="checkbox"
                          value={option}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>

                {errors.sharingReason ? (
                  <small className="access-field-error">
                    {errors.sharingReason}
                  </small>
                ) : null}
              </fieldset>

              <label className="access-text-field access-textarea-field">
                <span>
                  Tell us about a song, playlist, or mix that mattered to you.
                </span>
                <p className="access-question-helper">
                  Optional, but this is often the most useful answer in the
                  whole request.
                </p>
                <textarea
                  maxLength={2000}
                  name="meaningfulStory"
                  placeholder="A few sentences is plenty."
                />
              </label>

              <label className="access-hp-field" aria-hidden="true">
                Website
                <input
                  autoComplete="off"
                  name="website"
                  tabIndex={-1}
                  type="text"
                />
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

              <div className="access-privacy-note">
                <p>
                  We read every response ourselves, and we won’t sell or share
                  your information.
                </p>
                <p>
                  Full details in our{" "}
                  <Link href="/privacy">Privacy Policy</Link>.
                </p>
              </div>

              <div className="access-submit-row">
                <button
                  className="access-primary-button"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting
                    ? "Sending request…"
                    : "Request beta access"}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
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