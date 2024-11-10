<script lang="ts">
	import type { ProcessedModel } from "$lib/server/models";
	import type { UsageInfo } from "$lib/types/Message";

	import { slide } from "svelte/transition";

	export let usage: UsageInfo;
	export let tokenInfo: ProcessedModel["tokenInfo"];

	let expanded = false;

	function formatTokenCount(count: number): string {
		return count.toLocaleString();
	}

	function formatPercentage(value: number): string {
		if (value < 0.01) return "0.1%";
		if (value >= 1) return Math.round(value * 100) + "%";
		return (Math.round(value * 1000) / 10).toFixed(1) + "%";
	}

	function formatCurrency(value: number | null): string {
		if (value === null) return "N/A";
		if (value < 0.01) return "< $0.01";
		return "$" + (Math.ceil(value * 100) / 100).toFixed(2);
	}

	function formatTableCost(value: number | null): string {
		if (value === null) return "N/A";
		return "$" + value.toFixed(4);
	}

	function formatPrice(value: number): string {
		return "$" + value.toFixed(2);
	}

	$: hasReasoning = (usage.reasoning_tokens ?? 0) > 0;
	$: actualInputTokens = Math.max(0, usage.input_tokens - (usage.cached_tokens ?? 0));
	$: isCached = (usage.cached_tokens ?? 0) > 0;
	$: totalTokens = usage.input_tokens + usage.output_tokens + (usage.reasoning_tokens ?? 0);

	$: percentageUsed = totalTokens / (tokenInfo?.contextWindow ?? 1);

	let cost: number | null = null;

	$: {
		if (tokenInfo?.pricing) {
			const inputCostPerToken = tokenInfo.pricing.input;
			const outputCostPerToken = tokenInfo.pricing.output;
			const cachedCostPerToken = tokenInfo.pricing.cached ?? inputCostPerToken;

			const inputTokensCost = actualInputTokens * inputCostPerToken;
			const cachedTokensCost = (usage.cached_tokens ?? 0) * cachedCostPerToken;
			const outputTokensCost = usage.output_tokens * outputCostPerToken;
			const reasoningTokensCost = (usage.reasoning_tokens ?? 0) * outputCostPerToken; // Use output pricing

			cost =
				(inputTokensCost + cachedTokensCost + outputTokensCost + reasoningTokensCost) / 1_000_000;
		} else {
			cost = null; // Make sure to set cost to null if pricing information isn't available
		}
	}
</script>

<div class="mt-4 text-sm">
	<button
		class="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
		on:click={() => (expanded = !expanded)}
	>
		{#if tokenInfo?.pricing}
			<span
				>Last Turn: {formatCurrency(cost)}{#if isCached}<sup>*</sup>{/if}{#if hasReasoning}<sup
						>†</sup
					>{/if} | Context Use: {formatPercentage(percentageUsed)}</span
			>
		{:else}
			<span>Context Use: {formatPercentage(percentageUsed)}</span>
		{/if}
	</button>

	{#if expanded}
		<div transition:slide={{ duration: 300 }} class="mt-2 text-gray-500 dark:text-gray-400">
			<div
				class="prose w-1/3 min-w-[300px] max-w-none text-sm dark:prose-invert max-sm:prose-sm prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-pre:bg-gray-800 dark:prose-pre:bg-gray-900"
			>
				<table>
					<thead>
						<tr>
							<th>Type</th>
							<th class="text-right">Tokens</th>
							{#if tokenInfo?.pricing}
								<th class="text-right">Price (m/tok)</th>
								<th class="text-right">Cost</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#if usage.cached_tokens && usage.cached_tokens > 0}
							<tr>
								<td class="pr-2">Cached<sup>*</sup></td>
								<td class="px-2 text-right">{formatTokenCount(usage.cached_tokens)}</td>
								{#if tokenInfo?.pricing}
									<td class="px-2 text-right">
										{formatPrice(tokenInfo.pricing.cached ?? tokenInfo.pricing.input)}
									</td>
									<td class="pl-2 text-right">
										{formatTableCost(
											((usage.cached_tokens ?? 0) *
												(tokenInfo.pricing.cached ?? tokenInfo.pricing.input)) /
												1_000_000
										)}
									</td>
								{/if}
							</tr>
						{/if}
						<tr>
							<td class="pr-2">Input</td>
							<td class="px-2 text-right">{formatTokenCount(actualInputTokens)}</td>
							{#if tokenInfo?.pricing}
								<td class="px-2 text-right">{formatPrice(tokenInfo.pricing.input)}</td>
								<td class="pl-2 text-right">
									{formatTableCost((actualInputTokens * tokenInfo.pricing.input) / 1_000_000)}
								</td>
							{/if}
						</tr>
						{#if usage.reasoning_tokens && usage.reasoning_tokens > 0}
							<tr>
								<td class="pr-2">Reasoning<sup>†</sup></td>
								<td class="px-2 text-right">{formatTokenCount(usage.reasoning_tokens)}</td>
								{#if tokenInfo?.pricing}
									<td class="px-2 text-right">
										{formatPrice(tokenInfo.pricing.output)}
										<!-- Use output pricing -->
									</td>
									<td class="pl-2 text-right">
										{formatTableCost(
											((usage.reasoning_tokens ?? 0) * tokenInfo.pricing.output) / 1_000_000
										)}
									</td>
								{/if}
							</tr>
						{/if}
						<tr>
							<td class="pr-2">Output</td>
							<td class="px-2 text-right">{formatTokenCount(usage.output_tokens)}</td>
							{#if tokenInfo?.pricing}
								<td class="px-2 text-right">{formatPrice(tokenInfo.pricing.output)}</td>
								<td class="pl-2 text-right">
									{formatTableCost((usage.output_tokens * tokenInfo.pricing.output) / 1_000_000)}
								</td>
							{/if}
						</tr>
						<tr class="font-semibold">
							<td class="pr-2">Total</td>
							<td class="px-2 text-right">{formatTokenCount(totalTokens)}</td>
							{#if tokenInfo?.pricing}
								<td />
								<td class="pl-2 text-right">{formatTableCost(cost)}</td>
							{/if}
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
