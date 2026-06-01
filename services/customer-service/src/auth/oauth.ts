export interface OAuthProfile {
  oauth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  oauth_provider: string;
}

export async function verifyOAuthToken(
  provider: string,
  token: string
): Promise<OAuthProfile> {
  const supported = (process.env.OAUTH_SUPPORTED_PROVIDERS ?? "google")
    .split(",")
    .map((p) => p.trim());

  if (!supported.includes(provider)) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  switch (provider) {
    case "google":
      return verifyGoogleToken(token);
    default:
      throw new Error(`No verifier implemented for provider: ${provider}`);
  }
}

async function verifyGoogleToken(token: string): Promise<OAuthProfile> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
  );

  if (!res.ok) {
    throw new Error("Google token verification failed");
  }

  const data = (await res.json()) as any;

  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  if (clientId && data.aud !== clientId) {
    throw new Error("Google token audience mismatch");
  }

  if (!data.sub || !data.email) {
    throw new Error("Google token missing required fields");
  }

  return {
    oauth_id: data.sub,
    email: data.email,
    first_name: data.given_name ?? "",
    last_name: data.family_name ?? "",
    oauth_provider: "google",
  };
}
