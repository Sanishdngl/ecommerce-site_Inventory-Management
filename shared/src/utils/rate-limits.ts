import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/** Coarse ceiling applied to every request in app.ts, ahead of routing. */
export const globalRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 100,
  message: { message: "Too many requests — try again later" },
});

/** Brute-force protection on the admin login endpoint specifically. */
export const adminLoginRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  message: { message: "Too many login attempts — try again later" },
});

/** Shared across customer register/login/oauth — same budget, one bucket. */
export const customerAuthRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  message: { message: "Too many attempts — try again later" },
});
