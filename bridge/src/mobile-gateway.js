import crypto from "crypto";
import axios from "axios";
import express from "express";
import { SignJWT, jwtVerify } from "jose";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 30;

/** @type {Map<string, { count: number, reset: number }>} */
const loginAttempts = new Map();

/** @type {Map<string, { headers: Record<string, string>, exp: number }>} */
const sessions = new Map();

function getJwtSecret() {
  const raw = (process.env.BRIDGE_MOBILE_JWT_SECRET || "").trim();
  if (raw.length < 24) return null;
  return new TextEncoder().encode(raw);
}

function normalizeAxiosHeaders(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (v == null) continue;
    out[String(k).toLowerCase()] = String(v);
  }
  return out;
}

function extractChatwootAuthFromResponse(res) {
  const h = normalizeAxiosHeaders(res.headers);
  const access = h["access-token"];
  const client = h["client"];
  const uid = h["uid"];
  if (access && client && uid) {
    const auth = {
      "access-token": access,
      client,
      uid,
    };
    if (h["token-type"]) auth["token-type"] = h["token-type"];
    if (h["expiry"]) auth.expiry = h["expiry"];
    return auth;
  }
  return null;
}

async function signInToChatwoot(baseUrl, email, password) {
  const base = String(baseUrl).replace(/\/$/, "");
  const headersJson = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const tryJson = () =>
    axios.post(`${base}/auth/sign_in`, { email, password }, {
      headers: headersJson,
      validateStatus: () => true,
    });
  const tryForm = () => {
    const body = new URLSearchParams();
    body.set("email", email);
    body.set("password", password);
    return axios.post(`${base}/auth/sign_in`, body.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      validateStatus: () => true,
    });
  };
  let res = await tryJson();
  if (res.status < 200 || res.status >= 300) {
    res = await tryForm();
  }
  return res;
}

function rateLimitOk(ip) {
  const now = Date.now();
  let w = loginAttempts.get(ip);
  if (!w || now > w.reset) {
    w = { count: 0, reset: now + LOGIN_WINDOW_MS };
  }
  w.count += 1;
  loginAttempts.set(ip, w);
  return w.count <= MAX_LOGIN_ATTEMPTS;
}

function mobileCors(req, res, next) {
  if (!req.path.startsWith("/mobile/v1")) return next();
  const origin = process.env.BRIDGE_CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, PUT, POST, DELETE, PATCH, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
}

/**
 * @param {import("express").Application} app
 * @param {string} chatwootBaseUrl
 */
export function mountMobileGateway(app, chatwootBaseUrl) {
  app.use(mobileCors);

  const mobileRouter = express.Router();

  mobileRouter.post("/auth/login", async (req, res) => {
    const secret = getJwtSecret();
    if (!secret) {
      return res.status(503).json({
        error: "mobile_auth_disabled",
        message:
          "Задайте BRIDGE_MOBILE_JWT_SECRET (мин. 24 символа) и перезапустите мост.",
      });
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!rateLimitOk(ip)) {
      return res.status(429).json({ error: "too_many_attempts" });
    }

    const email = String((req.body && req.body.email) || "").trim();
    const password = String((req.body && req.body.password) || "");
    if (!email || !password) {
      return res.status(400).json({ error: "email_and_password_required" });
    }

    try {
      const cwRes = await signInToChatwoot(chatwootBaseUrl, email, password);
      const authHeaders = extractChatwootAuthFromResponse(cwRes);

      if (cwRes.status < 200 || cwRes.status >= 300 || !authHeaders) {
        const body =
          typeof cwRes.data === "object" && cwRes.data !== null
            ? cwRes.data
            : { raw: cwRes.data };
        return res.status(cwRes.status >= 400 ? cwRes.status : 401).json({
          error: "chatwoot_login_failed",
          chatwootStatus: cwRes.status,
          details: body,
          hint:
            !authHeaders && cwRes.status >= 200 && cwRes.status < 300
              ? "Chatwoot ответил без заголовков devise (access-token, client, uid). Проверьте версию Chatwoot."
              : undefined,
        });
      }

      const sid = crypto.randomBytes(24).toString("hex");
      sessions.set(sid, {
        headers: authHeaders,
        exp: Date.now() + SESSION_TTL_MS,
      });

      const token = await new SignJWT({ sid })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(secret);

      return res.json({
        accessToken: token,
        expiresIn: 12 * 3600,
        tokenType: "Bearer",
      });
    } catch (err) {
      console.warn("[mobile-gateway] login error:", err.message);
      return res.status(502).json({
        error: "chatwoot_unreachable",
        message: err.message,
      });
    }
  });

  async function requireMobileJwt(req, res, next) {
    const secret = getJwtSecret();
    if (!secret) {
      return res.status(503).json({ error: "mobile_auth_disabled" });
    }
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(\S+)/i);
    if (!m) {
      return res.status(401).json({ error: "missing_bearer_token" });
    }
    let sid;
    try {
      const { payload } = await jwtVerify(m[1], secret);
      sid = payload.sid;
    } catch {
      return res.status(401).json({ error: "invalid_token" });
    }
    if (!sid || typeof sid !== "string") {
      return res.status(401).json({ error: "invalid_token" });
    }
    const session = sessions.get(sid);
    if (!session || session.exp < Date.now()) {
      sessions.delete(sid);
      return res.status(401).json({ error: "session_expired" });
    }
    req.mobileSessionId = sid;
    req.mobileChatwootAuth = session.headers;
    next();
  }

  mobileRouter.post("/auth/logout", requireMobileJwt, (req, res) => {
    sessions.delete(req.mobileSessionId);
    return res.json({ ok: true });
  });

  mobileRouter.use("/cw", requireMobileJwt, async (req, res) => {
    const base = String(chatwootBaseUrl).replace(/\/$/, "");
    const forwardPath = req.url.startsWith("/") ? req.url : `/${req.url}`;
    const targetUrl = `${base}${forwardPath}`;

    const headers = {
      ...req.mobileChatwootAuth,
      Accept: "application/json",
    };
    if (
      req.body &&
      typeof req.body === "object" &&
      !["GET", "HEAD"].includes(req.method)
    ) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const ax = await axios({
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers,
        data: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
        validateStatus: () => true,
      });

      if (typeof ax.data === "object" && ax.data !== null && !Buffer.isBuffer(ax.data)) {
        return res.status(ax.status).json(ax.data);
      }
      return res.status(ax.status).send(ax.data);
    } catch (err) {
      console.warn("[mobile-gateway] proxy:", err.message);
      return res.status(502).json({ error: "chatwoot_proxy_failed", message: err.message });
    }
  });

  app.use("/mobile/v1", mobileRouter);
}
