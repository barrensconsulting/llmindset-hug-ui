import type { TextGenerationStreamOutput } from "@huggingface/inference";
import type OpenAI from "openai";
import type { Stream } from "openai/streaming";
import type { UsageInfo } from "$lib/types/Message";
import type { ToolCall } from "$lib/types/Tool";

type ToolCallWithParameters = {
	toolCall: ToolCall;
	parameterJsonString: string;
};

function prepareToolCalls(toolCallsWithParameters: ToolCallWithParameters[], tokenId: number) {
	const toolCalls: ToolCall[] = [];

	for (const toolCallWithParameters of toolCallsWithParameters) {
		// HACK: sometimes gpt4 via azure returns the JSON with literal newlines in it
		// like {\n "foo": "bar" }
		const s = toolCallWithParameters.parameterJsonString.replace("\n", "");
		const params = JSON.parse(s);

		const toolCall = toolCallWithParameters.toolCall;
		for (const name in params) {
			toolCall.parameters[name] = params[name];
		}

		toolCalls.push(toolCall);
	}

	const output = {
		token: {
			id: tokenId,
			text: "",
			logprob: 0,
			special: false,
			toolCalls,
		},
		generated_text: null,
		details: null,
	};

	return output;
}

/**
 * Transform a stream of OpenAI.Chat.ChatCompletion into a stream of TextGenerationStreamOutput
 */
export async function* openAIChatToTextGenerationStream(
	completionStream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
) {
	let generatedText = "";
	let tokenId = 0;
	const toolCalls: ToolCallWithParameters[] = [];
	let usage: UsageInfo | undefined;

	for await (const completion of completionStream) {
		const { choices } = completion;
		const content = choices[0]?.delta?.content ?? "";
		//const last = choices[0]?.finish_reason === "stop" || choices[0]?.finish_reason === "length";
		if (content) {
			generatedText += content;
			// Yield intermediate updates without generated_text
			yield {
				token: {
					id: tokenId++,
					text: content,
					logprob: 0,
					special: false,
				},
				generated_text: null,
				details: null,
			} as TextGenerationStreamOutput;
		}

		const tools = completion.choices[0]?.delta?.tool_calls || [];
		for (const tool of tools) {
			if (tool.id) {
				if (!tool.function?.name) {
					throw new Error("Tool call without function name");
				}
				const toolCallWithParameters: ToolCallWithParameters = {
					toolCall: {
						name: tool.function.name,
						parameters: {},
					},
					parameterJsonString: "",
				};
				toolCalls.push(toolCallWithParameters);
			}

			if (toolCalls.length > 0 && tool.function?.arguments) {
				toolCalls[toolCalls.length - 1].parameterJsonString += tool.function.arguments;
			}
		}

		if (choices[0]?.finish_reason === "tool_calls") {
			yield prepareToolCalls(toolCalls, tokenId++);
		}

		if (completion.usage) {
			usage = {
				input_tokens: completion.usage.prompt_tokens,
				output_tokens: completion.usage.completion_tokens,
			};
			const cachedTokens = completion.usage.prompt_tokens_details?.cached_tokens;
			if (cachedTokens && cachedTokens > 0) {
				usage.cached_tokens = cachedTokens;
			}
		}
	}

	// Yield the final output with generated_text and usage
	yield {
		token: {
			id: tokenId,
			text: "",
			logprob: 0,
			special: true,
		},
		generated_text: generatedText,
		details: null,
		...(usage && { usage }),
	} as TextGenerationStreamOutput & { usage?: UsageInfo };
}

/**
 * Transform a non-streaming OpenAI chat completion into a stream of TextGenerationStreamOutput
 */
export async function* openAIChatToTextGenerationSingle(
	completion: OpenAI.Chat.Completions.ChatCompletion
) {
	const content = completion.choices[0]?.message?.content || "";
	const tokenId = 0;

	// Yield the content as a single token
	yield {
		token: {
			id: tokenId,
			text: content,
			logprob: 0,
			special: false,
		},
		generated_text: content,
		details: null,
		...(completion.usage && {
			usage: {
				input_tokens: completion.usage.prompt_tokens,
				output_tokens: completion.usage.completion_tokens,
				cached_tokens: completion.usage.prompt_tokens_details?.cached_tokens,
				reasoning_tokens: completion.usage.completion_tokens_details?.reasoning_tokens,
			},
		}),
	} as TextGenerationStreamOutput;
}
