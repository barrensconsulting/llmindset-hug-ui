<script lang="ts">
	import type { PageData } from "./$types";

	import { env as envPublic } from "$env/dynamic/public";
	import { isHuggingChat } from "$lib/utils/isHuggingChat";

	import { base } from "$app/paths";
	import { page } from "$app/stores";

	import CarbonHelpFilled from "~icons/carbon/help-filled";
	import CarbonTools from "~icons/carbon/tools";
	import CarbonImage from "~icons/carbon/image";
	export let data: PageData;
</script>

<svelte:head>
	{#if isHuggingChat}
		<title>HuggingChat - Models</title>
		<meta property="og:title" content="HuggingChat - Models" />
		<meta property="og:type" content="link" />
		<meta property="og:description" content="Browse HuggingChat available models" />
		<meta property="og:url" content={$page.url.href} />
	{/if}
</svelte:head>

<div class="scrollbar-custom h-full overflow-y-auto py-12 max-sm:pt-8 md:py-24">
	<div class="pt-42 mx-auto flex flex-col px-5 xl:w-[60rem] 2xl:w-[64rem]">
		<div class="flex items-center">
			<h1 class="text-2xl font-bold">Models</h1>
			{#if isHuggingChat}
				<a
					href="https://huggingface.co/spaces/huggingchat/chat-ui/discussions/372"
					class="ml-auto dark:text-gray-400 dark:hover:text-gray-300"
					target="_blank"
				>
					<CarbonHelpFilled />
				</a>
			{/if}
		</div>
		<h3 class="text-gray-500">All models available on {envPublic.PUBLIC_APP_NAME}</h3>
		<dl class="mt-8 grid grid-cols-1 gap-3 sm:gap-5 xl:grid-cols-2">
			{#each data.models.filter((el) => !el.unlisted) as model, index (model.id)}
				<a
					href="{base}/models/{model.id}"
					class="relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-gray-50/50 px-6 py-5 shadow hover:bg-gray-50 hover:shadow-inner dark:border-gray-800/70 dark:bg-gray-950/20 dark:hover:bg-gray-950/40"
				>
					<div class="flex items-center justify-between gap-1">
						{#if model.logoUrl}
							<img
								class=" overflown aspect-square size-6 rounded border dark:border-gray-700"
								src={model.logoUrl}
								alt=""
							/>
						{:else}
							<div class="size-6 rounded border border-transparent bg-gray-300 dark:bg-gray-800" />
						{/if}
						{#if model.tools}
							<div
								class="ml-auto grid size-[21px] place-items-center rounded-lg border border-purple-300 dark:border-purple-700"
							>
								<CarbonTools class="text-xxs text-purple-700 dark:text-purple-500" />
							</div>
						{/if}
						{#if model.multimodal}
							<div
								title="This model is multimodal and supports image inputs natively."
								class="ml-auto flex size-[21px] items-center justify-center rounded-lg border border-blue-700 dark:border-blue-500"
							>
								<CarbonImage class="text-xxs text-blue-700 dark:text-blue-500" />
							</div>
						{/if}
						{#if index === 0}
							<div
								class="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-500 dark:text-gray-400"
							>
								Default
							</div>
						{/if}
					</div>
					<dt class="flex items-center gap-2 font-semibold">
						{model.displayName}
					</dt>
					<dd class="whitespace-pre-wrap text-sm text-gray-500 dark:text-gray-400">
						{model.description || "-"}
					</dd>
				</a>
			{/each}
		</dl>
	</div>
</div>
