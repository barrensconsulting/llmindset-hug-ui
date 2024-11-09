<script lang="ts">
	import { onMount } from "svelte";
	import { afterUpdate } from "svelte";
	import CopyToClipBoardBtn from "./CopyToClipBoardBtn.svelte";
	import MermaidLiveBtn from "./MermaidLiveBtn.svelte";
	import DOMPurify from "isomorphic-dompurify";
	import mermaid from "mermaid";
	import { default as hljs } from "highlight.js";
	import type { RenderResult } from "mermaid";
	import Code from "~icons/carbon/Code";
	import CodeHide from "~icons/carbon/CodeHide";

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

	// Initialize mermaid with better error handling
	onMount(() => {
		try {
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: "antiscript",
				theme: "dark" === localStorage.theme ? "dark" : "default",
				errorHandler: (error) => {
					console.error("Mermaid error:", error);
				},
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

	$: if (lang === "mermaid" && !loading && code) {
		showCode = false; // Default to diagram view when not loading
		mermaidState.error = null;
		mermaidState.rendered = false;
		renderPromise = parseAndRender(code, mermaidId);
	}

	afterUpdate(async () => {
		const language = hljs.getLanguage(lang);
		highlightedCode = hljs.highlightAuto(code, language?.aliases).value;
	});
</script>

<div
	class="group relative my-4 rounded-lg"
	role="region"
	aria-label={lang === "mermaid" ? "Mermaid diagram" : "Code block"}
>
	{#if lang === "mermaid" && mermaidState.rendered}
		{#await renderPromise}
			<pre>{code}</pre>
		{:then result}
			{#if result && result.svg && !mermaidState.error}
				{#if showCode}
					<pre
						class="scrollbar-custom overflow-auto px-5 scrollbar-thumb-gray-500 hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-white/10 dark:hover:scrollbar-thumb-white/20">
						<code class="language-{lang}"
							>{@html DOMPurify.sanitize(highlightedCode || code.replaceAll("<", "&lt;"))}</code
						>
					</pre>
				{:else}
					{@html result.svg}
				{/if}
			{:else}
				<pre>{DOMPurify.sanitize(code)}</pre>
				<p class="text-red-500" role="alert">
					{mermaidState.error?.message || "Unknown Error"}
				</p>
			{/if}
		{/await}
	{:else}
		<pre
			class="scrollbar-custom overflow-auto px-5 scrollbar-thumb-gray-500 hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-white/10 dark:hover:scrollbar-thumb-white/20">
			<code class="language-{lang}"
				>{@html DOMPurify.sanitize(highlightedCode || code.replaceAll("<", "&lt;"))}</code
			>
		</pre>
	{/if}

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
		{/if}
		<CopyToClipBoardBtn
			classNames="btn rounded-lg border border-gray-200 px-2 py-2 text-sm shadow-sm transition-all hover:border-gray-300 active:shadow-inner dark:border-gray-700 dark:hover:border-gray-500 dark:text-gray-700 text-gray-200"
			value={code}
		/>
	</div>
</div>
