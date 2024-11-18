<script lang="ts">
	import { onMount } from "svelte";
	import { afterUpdate } from "svelte";
	import CopyToClipBoardBtn from "./CopyToClipBoardBtn.svelte";
	import MermaidLiveBtn from "./MermaidLiveBtn.svelte";
	import DOMPurify from "isomorphic-dompurify";
	import mermaid from "mermaid";
	import type { RenderResult } from "mermaid";
	import { default as hljs } from "highlight.js";
	import Code from "~icons/carbon/Code";
	import CodeHide from "~icons/carbon/CodeHide";
	import ZoomIn from "~icons/carbon/ZoomIn";
	import ZoomOut from "~icons/carbon/ZoomOut";
	import ZoomFit from "~icons/carbon/ZoomFit";

	export let code = "";
	export let lang = "";
	export let loading = false;

	let highlightedCode = "";
	let mermaidId = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
	let renderPromise: Promise<RenderResult | null> | null = null;

	// Add type safety for mermaid error handling
	type MermaidError = {
		message: string;
		type: "parse" | "render" | "unknown";
	};

	// Simplified state management - remove loading state
	let mermaidState: {
		error: MermaidError | null;
		rendered: boolean;
	} = {
		error: null,
		rendered: false,
	};

	// SVG-specific types and configurations
	type SvgState = {
		error: string | null;
		scale: number;
		width: number;
		height: number;
	};

	let svgContainer: HTMLDivElement;
	//	let svgElement: SVGSVGElement | null = null;
	let svgState: SvgState = {
		error: null,
		scale: 1,
		width: 0,
		height: 0,
	};

	function sanitizeSvg(svg: string): string {
		/*		try {
			return DOMPurify.sanitize(svg, svgConfig);
		} catch (error) {
			svgState.error = "Failed to sanitize SVG content";
			return "";
		}
			*/
		//return DOMPurify.sanitize(svg);
		return svg;
	}

	// Initialize mermaid with better error handling
	onMount(() => {
		try {
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: "antiscript",
				theme: "dark" === localStorage.theme ? "dark" : "default",
			});
		} catch (error) {
			console.error("Mermaid initialization failed:", error);
		}
	});

	async function parseAndRender(code: string, id: string): Promise<RenderResult | null> {
		try {
			const parseResult = await mermaid.parse(code, { suppressErrors: true });
			if (parseResult === false) {
				mermaidState.error = {
					message: "Error displaying diagram. Check syntax in Mermaid Live.",
					type: "parse",
				};
				return null;
			}
			const result = await mermaid.render(id, code);
			return result;
		} catch (error: unknown) {
			mermaidState.error = {
				message: error instanceof Error ? error.message : "Unknown error",
				type: "render",
			};
			return null;
		} finally {
			mermaidState.rendered = true;
		}
	}

	// Add state for view toggle
	let showCode = loading;

	$: if (!loading && code) {
		if (lang === "mermaid") {
			showCode = false;
			mermaidState.error = null;
			mermaidState.rendered = false;
			renderPromise = parseAndRender(code, mermaidId);
		} else if (lang === "svg") {
			showCode = false;
		}
	}

	afterUpdate(async () => {
		const language = hljs.getLanguage(lang);
		highlightedCode = hljs.highlightAuto(code, language?.aliases).value;
	});

	function handleSvgLoad(container: HTMLDivElement) {
		if (!container) return;

		try {
			const svgElement = container.querySelector("svg");
			if (!svgElement) {
				svgState.error = "No SVG element found";
				return;
			}

			const viewBox = svgElement.viewBox.baseVal;
			const width =
				viewBox?.width ||
				svgElement.width.baseVal.value ||
				parseInt(svgElement.getAttribute("width") || "0");
			const height =
				viewBox?.height ||
				svgElement.height.baseVal.value ||
				parseInt(svgElement.getAttribute("height") || "0");

			if (!width || !height) {
				svgState.error = "Invalid SVG dimensions";
				return;
			}

			const containerWidth = container.clientWidth || window.innerWidth * 0.8;
			const containerHeight = window.innerHeight * 0.6;
			const scaleX = containerWidth / width;
			const scaleY = containerHeight / height;

			svgState = {
				...svgState,
				error: null,
				scale: Math.min(scaleX, scaleY, 1),
				width,
				height,
			};
		} catch (error) {
			svgState.error = "Failed to process SVG";
			console.error("SVG processing error:", error);
		}
	}

	function zoomIn() {
		svgState = { ...svgState, scale: Math.min(svgState.scale * 1.2, 5) };
	}

	function zoomOut() {
		svgState = { ...svgState, scale: Math.max(svgState.scale / 1.2, 0.1) };
	}

	function zoomFit() {
		if (svgContainer) handleSvgLoad(svgContainer);
	}

	// Use onMount to handle initial SVG loading
	onMount(() => {
		if (lang === "svg" && svgContainer) {
			// Add a small delay to ensure the SVG is rendered
			setTimeout(() => handleSvgLoad(svgContainer), 0);
		}
	});
</script>

<div
	class="group relative my-4 rounded-lg"
	role="region"
	aria-label={lang === "mermaid"
		? "Mermaid diagram"
		: lang === "svg"
		? "SVG diagram"
		: "Code block"}
>
	<!--
-->{#if lang === "mermaid" && mermaidState.rendered}<!--
    -->{#await renderPromise}<!--
        -->
			<pre>{code}</pre>
			<!--
    -->{:then result}<!--
        -->{#if result && result.svg && !mermaidState.error}<!--
            -->{#if showCode}<!--
                -->
					<pre
						class="scrollbar-custom overflow-auto px-5 scrollbar-thumb-gray-500 hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-white/10 dark:hover:scrollbar-thumb-white/20"><code
							class="language-{lang}"
							>{@html DOMPurify.sanitize(highlightedCode || code.replaceAll("<", "&lt;"))}</code
						></pre>
					<!--
            -->{:else}<!--
                -->{@html result.svg}<!--
            -->{/if}<!--
        -->{:else}<!--
            -->
				<pre>{DOMPurify.sanitize(code)}</pre>
				<!--
            -->
				<p class="text-red-500" role="alert">{mermaidState.error?.message || "Unknown Error"}</p>
				<!--
        -->{/if}<!--
    -->{/await}<!--
-->{:else if lang === "svg" && !showCode}<!--
    -->
		<div class="relative">
			<div bind:this={svgContainer} class="svg-container">
				{#if svgState.error}
					<p class="text-red-500" role="alert">{svgState.error}</p>
				{:else}
					<div
						class="svg-content"
						style="transform: scale({svgState.scale}); transform-origin: top left;"
					>
						{@html sanitizeSvg(code)}
					</div>
					<div
						class="absolute bottom-2 right-2 flex gap-2 rounded-lg bg-white/80 p-1 dark:bg-black/80"
					>
						<button
							on:click={zoomOut}
							class="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-800"
							aria-label="Zoom out"
						>
							<ZoomOut size={16} />
						</button>
						<button
							on:click={zoomFit}
							class="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-800"
							aria-label="Fit to view"
						>
							<ZoomFit size={16} />
						</button>
						<button
							on:click={zoomIn}
							class="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-800"
							aria-label="Zoom in"
						>
							<ZoomIn size={16} />
						</button>
					</div>
				{/if}
			</div>
		</div>
		<!--
-->{:else}<!--
    -->
		<pre
			class="scrollbar-custom overflow-auto px-5 scrollbar-thumb-gray-500 hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-white/10 dark:hover:scrollbar-thumb-white/20"><code
				class="language-{lang}"
				>{@html DOMPurify.sanitize(highlightedCode || code.replaceAll("<", "&lt;"))}</code
			></pre>
		<!--
-->{/if}

	<div
		class="invisible absolute right-2 top-2 flex gap-2 opacity-0 group-hover:visible group-hover:opacity-100"
	>
		{#if lang === "mermaid"}
			<MermaidLiveBtn
				classNames="btn rounded-lg border border-gray-200 px-2 py-2 text-sm shadow-sm transition-all hover:border-gray-300 active:shadow-inner dark:border-gray-700 dark:hover:border-gray-500 dark:text-gray-700 text-gray-200"
				value={code}
			/>
			<button
				on:click={() => (showCode = !showCode)}
				class="btn flex items-center rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-200 shadow-sm transition-all hover:border-gray-300 active:shadow-inner dark:border-gray-700 dark:text-gray-700 dark:hover:border-gray-500"
				aria-label={showCode ? "Show diagram" : "Show code"}
			>
				{#if showCode}
					<CodeHide size={16} class="text-current" />
				{:else}
					<Code size={16} class="text-current" />
				{/if}
			</button>
		{:else if lang === "svg"}
			<button
				on:click={() => (showCode = !showCode)}
				class="btn flex items-center rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-200 shadow-sm transition-all hover:border-gray-300 active:shadow-inner dark:border-gray-700 dark:text-gray-700 dark:hover:border-gray-500"
				aria-label={showCode ? "Show SVG" : "Show code"}
			>
				{#if showCode}
					<CodeHide size={16} class="text-current" />
				{:else}
					<Code size={16} class="text-current" />
				{/if}
			</button>
		{/if}
		<CopyToClipBoardBtn
			classNames="btn rounded-lg border border-gray-200 px-2 py-2 text-sm shadow-sm transition-all hover:border-gray-300 active:shadow-inner dark:border-gray-700 dark:hover:border-gray-500 dark:text-gray-700 text-gray-200"
			value={code}
		/>
	</div>
</div>

<style>
	.svg-container {
		width: 100%;
		max-height: 60vh;
		overflow: auto;
		position: relative;
		border: 1px solid transparent;
		display: flex;
		justify-content: center;
		align-items: start;
		padding: 1rem;
	}

	.svg-content {
		display: inline-block;
		min-width: min-content;
		margin: 0 auto;
	}

	.svg-content :global(svg) {
		display: block;
		height: auto;
		max-height: none;
		margin: 0 auto;
	}
</style>
