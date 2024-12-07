import type { MessageUpdate } from "./MessageUpdate";
import type { Timestamps } from "./Timestamps";
import type { WebSearch } from "./WebSearch";
import type { v4 } from "uuid";

// Add this type definition
export interface UsageInfo {
	input_tokens: number;
	output_tokens: number;
	cached_tokens?: number;
	reasoning_tokens?: number;
}

export type Message = Partial<Timestamps> & {
	from: "user" | "assistant" | "system";
	id: ReturnType<typeof v4>;
	content: string;
	updates?: MessageUpdate[];
	webSearchId?: WebSearch["_id"]; // legacy version
	webSearch?: WebSearch;

	reasoning?: string;
	score?: -1 | 0 | 1;
	/**
	 * Either contains the base64 encoded image data
	 * or the hash of the file stored on the server
	 **/
	files?: MessageFile[];
	interrupted?: boolean;

	// needed for conversation trees
	ancestors?: Message["id"][];

	// goes one level deep
	children?: Message["id"][];

	// the index of the current child in the children array of the message if the message has more than one child
	currentChildIndex?: number;

	// Add the optional usage field
	usage?: UsageInfo;
};

export type MessageFile = {
	type: "hash" | "base64";
	name: string;
	value: string;
	mime: string;
};
