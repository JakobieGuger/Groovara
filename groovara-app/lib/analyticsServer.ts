type ServerAnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export async function trackServerEvent(
  eventName: string,
  distinctId: string,
  properties: ServerAnalyticsProperties = {},
) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  try {
    const response = await fetch("https://us.i.posthog.com/capture/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        event: eventName,
        properties: {
          distinct_id: distinctId,
          app: "groovara",
          environment: process.env.NODE_ENV,
          ...properties,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok && process.env.NODE_ENV === "development") {
      console.warn(
        "PostHog server event failed:",
        eventName,
        response.status,
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("PostHog server event failed:", eventName, error);
    }
  }
}
