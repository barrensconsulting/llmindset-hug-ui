import { env } from "$env/dynamic/private";
import { env as envPublic } from "$env/dynamic/public";
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { collections } from "$lib/server/database";
import { base } from "$app/paths";
import { findUser, refreshSessionCookie, requiresUser } from "$lib/server/auth";
import { ERROR_MESSAGES } from "$lib/stores/errors";
import { sha256 } from "$lib/utils/sha256";
import { addWeeks } from "date-fns";
import { checkAndRunMigrations } from "$lib/migrations/migrations";
import { building } from "$app/environment";
import { logger } from "$lib/server/logger";
import { AbortedGenerations } from "$lib/server/abortedGenerations";
import { MetricsServer } from "$lib/server/metrics";
import { initExitHandler } from "$lib/server/exitHandler";
import { ObjectId } from "mongodb";
import { refreshAssistantsCounts } from "$lib/jobs/refresh-assistants-counts";
import { refreshConversationStats } from "$lib/jobs/refresh-conversation-stats";
import { verifyCloudflareAccessJWT } from "$lib/server/cloudflareAuth";
import { createHash } from "crypto";

import { DEFAULT_SETTINGS } from "$lib/types/Settings";

// TODO: move this code on a started server hook, instead of using a "building" flag
if (!building) {
	// Set HF_TOKEN as a process variable for Transformers.JS to see it
	process.env.HF_TOKEN ??= env.HF_TOKEN;

	logger.info("Starting server...");
	initExitHandler();

	checkAndRunMigrations();
	if (env.ENABLE_ASSISTANTS) {
		refreshAssistantsCounts();
	}
	refreshConversationStats();

	// Init metrics server
	MetricsServer.getInstance();

	// Init AbortedGenerations refresh process
	AbortedGenerations.getInstance();

	if (env.EXPOSE_API) {
		logger.warn(
			"The EXPOSE_API flag has been deprecated. The API is now required for chat-ui to work."
		);
	}
}

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	// handle 404

	if (building) {
		throw error;
	}

	if (event.route.id === null) {
		return {
			message: `Page ${event.url.pathname} not found`,
		};
	}

	const errorId = crypto.randomUUID();

	logger.error({
		locals: event.locals,
		url: event.request.url,
		params: event.params,
		request: event.request,
		message,
		error,
		errorId,
		status,
		stack: error instanceof Error ? error.stack : undefined,
	});

	return {
		message: "An error occurred",
		errorId,
	};
};

export const handle: Handle = async ({ event, resolve }) => {
	logger.debug({
		locals: event.locals,
		url: event.url.pathname,
		params: event.params,
		request: event.request,
	});

	function errorResponse(status: number, message: string) {
		const sendJson =
			event.request.headers.get("accept")?.includes("application/json") ||
			event.request.headers.get("content-type")?.includes("application/json");
		return new Response(sendJson ? JSON.stringify({ error: message }) : message, {
			status,
			headers: {
				"content-type": sendJson ? "application/json" : "text/plain",
			},
		});
	}

	if (event.url.pathname.startsWith(`${base}/admin/`) || event.url.pathname === `${base}/admin`) {
		const ADMIN_SECRET = env.ADMIN_API_SECRET || env.PARQUET_EXPORT_SECRET;

		if (!ADMIN_SECRET) {
			return errorResponse(500, "Admin API is not configured");
		}

		if (event.request.headers.get("Authorization") !== `Bearer ${ADMIN_SECRET}`) {
			return errorResponse(401, "Unauthorized");
		}
	}

	const token = event.cookies.get(env.COOKIE_NAME);

	// if the trusted email header is set we use it to get the user email
	const email = env.TRUSTED_EMAIL_HEADER
		? event.request.headers.get(env.TRUSTED_EMAIL_HEADER)
		: null;

	let secretSessionId: string | null = null;
	let sessionId: string | null = null;

	if (email) {
		secretSessionId = sessionId = await sha256(email);

		event.locals.user = {
			// generate id based on email
			_id: new ObjectId(sessionId.slice(0, 24)),
			name: email,
			email,
			createdAt: new Date(),
			updatedAt: new Date(),
			hfUserId: email,
			avatarUrl: "",
			logoutDisabled: true,
		};
	} else if (token) {
		secretSessionId = token;
		sessionId = await sha256(token);

		const user = await findUser(sessionId);

		if (user) {
			event.locals.user = user;
		}
	} else if (event.url.pathname.startsWith(`${base}/api/`) && env.USE_HF_TOKEN_IN_API === "true") {
		// if the request goes to the API and no user is available in the header
		// check if a bearer token is available in the Authorization header

		const authorization = event.request.headers.get("Authorization");

		if (authorization && authorization.startsWith("Bearer ")) {
			const token = authorization.slice(7);

			const hash = await sha256(token);

			sessionId = secretSessionId = hash;

			// check if the hash is in the DB and get the user
			// else check against https://huggingface.co/api/whoami-v2

			const cacheHit = await collections.tokenCaches.findOne({ tokenHash: hash });

			if (cacheHit) {
				const user = await collections.users.findOne({ hfUserId: cacheHit.userId });

				if (!user) {
					return errorResponse(500, "User not found");
				}

				event.locals.user = user;
			} else {
				const response = await fetch("https://huggingface.co/api/whoami-v2", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!response.ok) {
					return errorResponse(401, "Unauthorized");
				}

				const data = await response.json();
				const user = await collections.users.findOne({ hfUserId: data.id });

				if (!user) {
					return errorResponse(500, "User not found");
				}

				await collections.tokenCaches.insertOne({
					tokenHash: hash,
					userId: data.id,
					createdAt: new Date(),
					updatedAt: new Date(),
				});

				event.locals.user = user;
			}
		}
	}

	if (!sessionId || !secretSessionId) {
		secretSessionId = crypto.randomUUID();
		sessionId = await sha256(secretSessionId);

		if (await collections.sessions.findOne({ sessionId })) {
			return errorResponse(500, "Session ID collision");
		}
	}

	event.locals.sessionId = sessionId;

	// If no user is found via OIDC session or email, try Cloudflare Access
	if (!event.locals.user && env.CF_ACCESS_AUD && env.CF_ACCESS_TEAM_DOMAIN) {
		const cfToken = event.cookies.get("CF_Authorization");
		if (cfToken) {
			try {
				const payload = await verifyCloudflareAccessJWT(cfToken);
				const hash = createHash("md5").update(payload.sub).digest("hex").substring(0, 24);
				const objectId = new ObjectId(hash);

				const user = {
					_id: objectId,
					username: payload.email,
					name: payload.name || payload.email,
					email: payload.email,
					createdAt: new Date(),
					updatedAt: new Date(),
					hfUserId: payload.sub,
					avatarUrl: payload.picture || "",
				};

				// Create or update the user
				await collections.users.updateOne({ _id: user._id }, { $set: user }, { upsert: true });
				console.log("Cloudflare Access authentication successful:", user);
				event.locals.user = user;

				// Use the generated sessionId for Cloudflare Access users
				await collections.sessions.updateOne(
					{ sessionId },
					{
						$set: {
							userId: user._id,
							updatedAt: new Date(),
							expiresAt: addWeeks(new Date(), 2),
						},
					},
					{ upsert: true }
				);

				const existingSettings = await collections.settings.findOne({ userId: user._id });
				if (!existingSettings) {
					await collections.settings.insertOne({
						userId: user._id,
						ethicsModalAcceptedAt: new Date(),
						updatedAt: new Date(),
						createdAt: new Date(),
						...DEFAULT_SETTINGS,
					});
				}

				refreshSessionCookie(event.cookies, secretSessionId);
			} catch (error) {
				console.error("Cloudflare Access authentication failed:", error);
			}
		} else {
			console.log("No CF_Authorization cookie found");
		}
	}

	// CSRF protection
	const requestContentType = event.request.headers.get("content-type")?.split(";")[0] ?? "";
	/** https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form#attr-enctype */
	const nativeFormContentTypes = [
		"multipart/form-data",
		"application/x-www-form-urlencoded",
		"text/plain",
	];

	if (event.request.method === "POST") {
		if (nativeFormContentTypes.includes(requestContentType)) {
			const origin = event.request.headers.get("origin");

			if (!origin) {
				return errorResponse(403, "Non-JSON form requests need to have an origin");
			}

			const validOrigins = [
				new URL(event.request.url).host,
				...(envPublic.PUBLIC_ORIGIN ? [new URL(envPublic.PUBLIC_ORIGIN).host] : []),
			];

			if (!validOrigins.includes(new URL(origin).host)) {
				return errorResponse(403, "Invalid referer for POST request");
			}
		}
	}

	if (event.request.method === "POST") {
		// if the request is a POST request we refresh the cookie
		refreshSessionCookie(event.cookies, secretSessionId);

		await collections.sessions.updateOne(
			{ sessionId },
			{ $set: { updatedAt: new Date(), expiresAt: addWeeks(new Date(), 2) } }
		);
	}

	if (
		!event.url.pathname.startsWith(`${base}/login`) &&
		!event.url.pathname.startsWith(`${base}/admin`) &&
		!event.url.pathname.startsWith(`${base}/settings`) &&
		!["GET", "OPTIONS", "HEAD"].includes(event.request.method)
	) {
		if (
			!event.locals.user &&
			requiresUser &&
			!((env.MESSAGES_BEFORE_LOGIN ? parseInt(env.MESSAGES_BEFORE_LOGIN) : 0) > 0)
		) {
			return errorResponse(401, ERROR_MESSAGES.authOnly);
		}

		// if login is not required and the call is not from /settings and we display the ethics modal with PUBLIC_APP_DISCLAIMER
		//  we check if the user has accepted the ethics modal first.
		// If login is required, `ethicsModalAcceptedAt` is already true at this point, so do not pass this condition. This saves a DB call.
		if (
			!requiresUser &&
			!event.url.pathname.startsWith(`${base}/settings`) &&
			envPublic.PUBLIC_APP_DISCLAIMER === "1"
		) {
			const hasAcceptedEthicsModal = await collections.settings.countDocuments({
				sessionId: event.locals.sessionId,
				ethicsModalAcceptedAt: { $exists: true },
			});

			console.log("ETHICS MODAL ACCEPTED?" + hasAcceptedEthicsModal);
			if (!hasAcceptedEthicsModal) {
				return errorResponse(405, "You need to accept the welcome modal first");
			}
		}
	}

	let replaced = false;

	const response = await resolve(event, {
		transformPageChunk: (chunk) => {
			// For some reason, Sveltekit doesn't let us load env variables from .env in the app.html template
			if (replaced || !chunk.html.includes("%gaId%")) {
				return chunk.html;
			}
			replaced = true;

			return chunk.html.replace("%gaId%", envPublic.PUBLIC_GOOGLE_ANALYTICS_ID);
		},
	});

	// Add CSP header to disallow framing if ALLOW_IFRAME is not "true"
	if (env.ALLOW_IFRAME !== "true") {
		response.headers.append("Content-Security-Policy", "frame-ancestors 'none';");
	}

	return response;
};
