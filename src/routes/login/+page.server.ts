import { redirect } from "@sveltejs/kit";
import { getOIDCAuthorizationUrl } from "$lib/server/auth";
import { base } from "$app/paths";
import { env } from "$env/dynamic/private";

export const actions = {
	async default({ url, locals, request }) {
		const referer = request.headers.get("referer");
		let redirectURI = `${(referer ? new URL(referer) : url).origin}${base}/login/callback`;

		// TODO: Handle errors if provider is not responding

		if (url.searchParams.has("callback")) {
			const callback = url.searchParams.get("callback") || redirectURI;
			if (env.ALTERNATIVE_REDIRECT_URLS.includes(callback)) {
				redirectURI = callback;
			}
		}
		// Check if Cloudflare Access is configured
		if (env.CF_ACCESS_AUD && env.CF_ACCESS_TEAM_DOMAIN) {
			console.log("Cloudflare Access is configured, redirecting to home");
			throw redirect(303, "/");
		}

		const authorizationUrl = await getOIDCAuthorizationUrl(
			{ redirectURI },
			{ sessionId: locals.sessionId }
		);

		redirect(303, authorizationUrl);
	},
};
