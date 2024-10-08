import { dev } from "$app/environment";
import { base } from "$app/paths";
import { env } from "$env/dynamic/private";
import { collections } from "$lib/server/database";
import { redirect } from "@sveltejs/kit";

export const actions = {
	async default({ cookies, locals }) {
		await collections.sessions.deleteOne({ sessionId: locals.sessionId });

		cookies.delete(env.COOKIE_NAME, {
			path: "/",
			// So that it works inside the space's iframe
			sameSite: dev || env.ALLOW_INSECURE_COOKIES === "true" ? "lax" : "none",
			secure: !dev && !(env.ALLOW_INSECURE_COOKIES === "true"),
			httpOnly: true,
		});

		cookies.delete("CF_Authorization", { path: "/" });

		if (env.CF_ACCESS_LOGOUT_URL) {
			throw redirect(302, env.CF_ACCESS_LOGOUT_URL);
		}

		redirect(303, `${base}/`);
	},
};
