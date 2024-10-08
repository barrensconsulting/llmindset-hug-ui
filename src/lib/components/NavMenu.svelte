<script lang="ts">
	import { base } from "$app/paths";

	import Logo from "$lib/components/icons/Logo.svelte";
	import { switchTheme } from "$lib/switchTheme";
	import { isAborted } from "$lib/stores/isAborted";
	import { env as envPublic } from "$env/dynamic/public";
	import NavConversationItem from "./NavConversationItem.svelte";
	import type { LayoutData } from "../../routes/$types";
	import type { ConvSidebar } from "$lib/types/ConvSidebar";
	import type { Model } from "$lib/types/Model";
	import { page } from "$app/stores";
	import { writable } from "svelte/store";
	import AssistantFilterButton from "./AssistantFilterButton.svelte";
	import CarbonFilter from "~icons/carbon/filter";
	import CarbonSubtractAlt from "~icons/carbon/subtract-alt";
	export let conversations: ConvSidebar[] = [];
	export let canLogin: boolean;
	export let user: LayoutData["user"];

	let showFilters = false;

	function toggleFilters() {
		showFilters = !showFilters;
	}

	function handleNewChatClick() {
		isAborted.set(true);
	}

	const dateRanges = [
		new Date().setDate(new Date().getDate() - 1),
		new Date().setDate(new Date().getDate() - 7),
		new Date().setMonth(new Date().getMonth() - 1),
	];
	const selectedAssistant = writable<string>("");

	$: uniqueAssistants = Array.from(
		new Set(conversations.map((conv) => conv.assistantId).filter(Boolean))
	).map((id) => {
		const conv = conversations.find((c) => c.assistantId === id);
		return {
			id,
			name: conv?.assistantName,
			avatarHash: conv?.avatarHash,
		};
	});

	function handleAssistantFilter(assistantId: string | undefined) {
		if (assistantId) {
			selectedAssistant.update((current) => (current === assistantId ? "" : assistantId));
		}
	}

	$: filteredConversations =
		$selectedAssistant === ""
			? conversations
			: $selectedAssistant === "no-assistant"
			? conversations.filter((conv) => !conv.assistantId)
			: conversations.filter((conv) => conv.assistantId === $selectedAssistant);

	$: groupedConversations = {
		today: filteredConversations.filter(({ updatedAt }) => updatedAt.getTime() > dateRanges[0]),
		week: filteredConversations.filter(
			({ updatedAt }) => updatedAt.getTime() > dateRanges[1] && updatedAt.getTime() < dateRanges[0]
		),
		month: filteredConversations.filter(
			({ updatedAt }) => updatedAt.getTime() > dateRanges[2] && updatedAt.getTime() < dateRanges[1]
		),
		older: filteredConversations.filter(({ updatedAt }) => updatedAt.getTime() < dateRanges[2]),
	};

	const titles: { [key: string]: string } = {
		today: "Today",
		week: "This week",
		month: "This month",
		older: "Older",
	} as const;

	const nModels: number = $page.data.models.filter((el: Model) => !el.unlisted).length;
</script>

<div class="flex h-full flex-col">
	<!-- Header Section with Filter Buttons -->
	<div class="sticky top-0 flex-none px-3 py-3.5 max-sm:pt-0">
		<div class="mb-2 flex items-center justify-between">
			<a
				class="flex items-center rounded-xl text-lg font-semibold"
				href="{envPublic.PUBLIC_ORIGIN}{base}/"
			>
				<Logo classNames="mr-1" />
				{envPublic.PUBLIC_APP_NAME}
			</a>
			<div class="flex gap-2">
				<button
					on:click={toggleFilters}
					class="flex items-center rounded-lg border bg-white px-2 py-0.5 text-center shadow-sm hover:shadow-none dark:border-gray-600 dark:bg-gray-700 sm:text-smd"
					><CarbonFilter class=" h-4 w-4" /></button
				>
				<a
					href={`${base}/`}
					on:click={handleNewChatClick}
					class="flex rounded-lg border bg-white px-2 py-0.5 text-center shadow-sm hover:shadow-none dark:border-gray-600 dark:bg-gray-700 sm:text-smd"
				>
					New Chat
				</a>
			</div>
		</div>

		<!-- Filter Buttons -->
		{#if showFilters}
			<div
				class="mt-2 flex max-h-20 flex-wrap items-center gap-2 overflow-y-auto rounded-xl bg-gray-50 p-2 dark:bg-gray-800/30"
			>
				{#each uniqueAssistants as assistant}
					<AssistantFilterButton
						assistantId={assistant.id}
						avatarHash={assistant.avatarHash}
						assistantName={assistant.name}
						isActive={$selectedAssistant === assistant.id}
						onClick={() => handleAssistantFilter(assistant.id)}
					/>
				{/each}
				<AssistantFilterButton
					assistantId={"no-assistant"}
					avatarHash={""}
					assistantName="No Assistant"
					isActive={$selectedAssistant === "no-assistant"}
					onClick={() => handleAssistantFilter("no-assistant")}
				>
					<CarbonSubtractAlt class="h-5 w-5" />
				</AssistantFilterButton>
			</div>
		{/if}
	</div>
</div>

<div
	class="scrollbar-custom flex flex-col gap-1 overflow-y-auto rounded-r-xl from-gray-50 px-3 pb-3 pt-2 text-[.9rem] dark:from-gray-800/30 max-sm:bg-gradient-to-t md:bg-gradient-to-l"
>
	{#each Object.entries(groupedConversations) as [group, convs]}
		{#if convs.length}
			<h4 class="mb-1.5 mt-4 pl-0.5 text-sm text-gray-400 first:mt-0 dark:text-gray-500">
				{titles[group]}
			</h4>
			{#each convs as conv}
				<NavConversationItem on:editConversationTitle on:deleteConversation {conv} />
			{/each}
		{/if}
	{/each}
</div>
<div
	class="mt-0.5 flex flex-col gap-1 rounded-r-xl p-3 text-sm md:bg-gradient-to-l md:from-gray-50 md:dark:from-gray-800/30"
>
	{#if user?.username || user?.email}
		<form
			action="{base}/logout"
			method="post"
			class="group flex items-center gap-1.5 rounded-lg pl-2.5 pr-2 hover:bg-gray-100 dark:hover:bg-gray-700"
		>
			<span
				class="flex h-9 flex-none shrink items-center gap-1.5 truncate pr-2 text-gray-500 dark:text-gray-400"
				>{user?.username || user?.email}</span
			>
			{#if !user.logoutDisabled}
				<button
					type="submit"
					class="ml-auto h-6 flex-none items-center gap-1.5 rounded-md border bg-white px-2 text-gray-700 shadow-sm group-hover:flex hover:shadow-none dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400 dark:hover:text-gray-300 md:hidden"
				>
					Sign Out
				</button>
			{/if}
		</form>
	{/if}
	{#if canLogin}
		<form action="{base}/login" method="POST" target="_parent">
			<button
				type="submit"
				class="flex h-9 w-full flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
			>
				Login
			</button>
		</form>
	{/if}
	<button
		on:click={switchTheme}
		type="button"
		class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
	>
		Theme
	</button>
	{#if nModels > 1}
		<a
			href="{base}/models"
			class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
		>
			Models
			<span
				class="ml-auto rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-500 dark:text-gray-400"
				>{nModels}</span
			>
		</a>
	{/if}
	{#if $page.data.enableAssistants}
		<a
			href="{base}/assistants"
			class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
		>
			Assistants
		</a>
	{/if}
	{#if $page.data.enableCommunityTools}
		<a
			href="{base}/tools"
			class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
		>
			Tools
			<span
				class="ml-auto rounded-full border border-purple-300 px-2 py-0.5 text-xs text-purple-500 dark:border-purple-500 dark:text-purple-400"
				>New</span
			>
		</a>
	{/if}

	<a
		href="{base}/settings"
		class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
	>
		Settings
	</a>
	{#if envPublic.PUBLIC_APP_NAME === "HuggingChat"}
		<a
			href="{base}/privacy"
			class="flex h-9 flex-none items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
		>
			About & Privacy
		</a>
	{/if}
</div>
