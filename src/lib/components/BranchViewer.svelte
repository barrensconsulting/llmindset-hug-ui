<script lang="ts">
	import { onMount, afterUpdate, createEventDispatcher } from "svelte";
	import mermaid from "mermaid";

	export let chartDefinition: string;
	export let messageId: string;

	const dispatch = createEventDispatcher<{
		navigate: { id: string };
	}>();

	let mermaidEl: HTMLElement;
	let currentDefinition: string = "";

	onMount(() => {
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "loose",
			theme: "dark" === localStorage.theme ? "dark" : "default",
		});
	});

	afterUpdate(() => {
		if (currentDefinition !== chartDefinition) {
			renderChart();
			currentDefinition = chartDefinition;
		}
	});

	async function renderChart() {
		if (!mermaidEl) return;

		try {
			mermaidEl.innerHTML = ""; // Clear previous content
			const { svg, bindFunctions } = await mermaid.render(`mermaid-${messageId}`, chartDefinition);
			mermaidEl.innerHTML = svg;

			if (bindFunctions) {
				bindFunctions(mermaidEl);
			}
		} catch (error) {
			console.error("Error rendering Mermaid chart:", error);
			//			mermaidEl.innerHTML = `<p>Error rendering chart: ${error.message}</p>`;
		}
	}

	// Callback function for Mermaid click events
	function mermaidClickCallback(nodeId: string) {
		dispatch("navigate", { id: nodeId });
	}

	// Make the callback function available globally
	if (typeof window !== "undefined") {
		(window as any).mermaidClickCallback = mermaidClickCallback;
	}
</script>

<div bind:this={mermaidEl} />

<style>
	div :global(.node) {
		cursor: pointer;
	}
	div :global(.node:hover) {
		opacity: 0.8;
	}
	:global(.mermaidTooltip) {
		position: absolute;
		text-align: center;
		max-width: 200px;
		padding: 2px;
		font-family: "trebuchet ms", verdana, arial, sans-serif;
		font-size: 12px;
		background: #ffffde;
		border: 1px solid #aaaa33;
		border-radius: 2px;
		pointer-events: none;
		z-index: 100;
	}
</style>
