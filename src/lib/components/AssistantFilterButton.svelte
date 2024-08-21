<script lang="ts">
	import { base } from "$app/paths";

	export let assistantName: string | undefined;
	export let assistantId: string | undefined;
	export let avatarHash: string | undefined;
	export let isActive: boolean;
	export let onClick: () => void;

	$: initial = assistantName ? assistantName.charAt(0).toUpperCase() : "?";
</script>

<button
	on:click={onClick}
	class="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full text-sm font-semibold {isActive
		? 'ring-2 ring-blue-500'
		: ''}"
	class:bg-gray-300={!avatarHash}
	title={assistantName || assistantId}
>
	{#if $$slots.default}
		<slot />
	{:else if avatarHash}
		<img
			src="{base}/settings/assistants/{assistantId}/avatar.jpg?hash={avatarHash}"
			alt="Assistant avatar"
			class="h-full w-full object-cover"
		/>
	{:else if assistantId}
		<div
			class="flex h-full w-full items-center justify-center text-xs font-bold uppercase text-gray-500"
		>
			{initial}
		</div>
	{:else}
		<div
			class="flex h-full w-full items-center justify-center text-xs font-bold uppercase text-gray-500"
		>
			?
		</div>
	{/if}
</button>
