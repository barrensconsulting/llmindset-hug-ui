<script lang="ts">
	export let assistantId: string | undefined;
	export let assistantName: string | undefined;
	export let avatarUrl: string | undefined;
	export let isActive: boolean;
	export let onClick: () => void;

	$: initial = assistantName ? assistantName.charAt(0).toUpperCase() : "?";
</script>

<button
	on:click={onClick}
	class="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full text-sm font-semibold {isActive
		? 'ring-2 ring-blue-500'
		: ''}"
	class:bg-gray-300={!avatarUrl}
	title={assistantName || assistantId}
>
	{#if $$slots.default}
		<slot />
	{:else if avatarUrl}
		<img src={avatarUrl} alt="Assistant avatar" class="h-full w-full object-cover" />
	{:else}
		<div
			class="flex h-full w-full items-center justify-center text-xs font-bold uppercase text-gray-500"
		>
			{initial}
		</div>
	{/if}
</button>
