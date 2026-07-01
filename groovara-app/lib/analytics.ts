"use client";

import posthog from "posthog-js";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export function trackEvent(
  eventName: string,
  properties?: AnalyticsProperties
) {
  if (typeof window === "undefined") return;

  try {
    posthog.capture(eventName, {
      app: "groovara",
      environment: process.env.NODE_ENV,
      is_localhost: window.location.hostname === "localhost",
      ...properties,
    });

    if (process.env.NODE_ENV === "development") {
      console.info("PostHog event captured:", eventName, properties);
    }
  } catch (error) {
    console.warn("PostHog event failed:", eventName, error);
  }
}