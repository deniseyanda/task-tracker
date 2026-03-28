import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const MODEL = "claude-sonnet-4-6";

function extractSystemText(messages: Message[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => {
      const parts = Array.isArray(m.content) ? m.content : [m.content];
      return parts
        .map((p) => (typeof p === "string" ? p : p.type === "text" ? p.text : ""))
        .join("");
    })
    .join("\n");
}

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    const role: "user" | "assistant" =
      msg.role === "assistant" ? "assistant" : "user";

    const parts = Array.isArray(msg.content) ? msg.content : [msg.content];

    const contentBlocks: Anthropic.ContentBlockParam[] = parts
      .map((p): Anthropic.ContentBlockParam | null => {
        if (typeof p === "string") return { type: "text", text: p };
        if (p.type === "text") return { type: "text", text: p.text };
        if (p.type === "image_url") {
          const url = p.image_url.url;
          if (url.startsWith("data:")) {
            const commaIdx = url.indexOf(",");
            const meta = url.slice(0, commaIdx);
            const data = url.slice(commaIdx + 1);
            const mediaType = meta
              .replace("data:", "")
              .replace(";base64", "") as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp";
            return {
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            };
          }
          return { type: "image", source: { type: "url", url } };
        }
        return null;
      })
      .filter((b): b is Anthropic.ContentBlockParam => b !== null);

    const content: string | Anthropic.ContentBlockParam[] =
      contentBlocks.length === 1 && contentBlocks[0].type === "text"
        ? (contentBlocks[0] as Anthropic.TextBlockParam).text
        : contentBlocks;

    // Merge consecutive same-role messages by appending to the last entry
    const last = result[result.length - 1];
    if (last && last.role === role) {
      const existing = Array.isArray(last.content)
        ? last.content
        : [{ type: "text" as const, text: last.content as string }];
      const incoming = Array.isArray(content)
        ? content
        : [{ type: "text" as const, text: content as string }];
      last.content = [...existing, ...incoming];
    } else {
      result.push({ role, content });
    }
  }

  return result;
}

function toAnthropicTools(tools: Tool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: (t.function.parameters as Anthropic.Tool["input_schema"]) ?? {
      type: "object" as const,
      properties: {},
    },
  }));
}

function resolveSchema(params: InvokeParams): JsonSchema | undefined {
  const rf = params.responseFormat || params.response_format;
  if (rf?.type === "json_schema") return rf.json_schema;
  return params.outputSchema || params.output_schema;
}

function mapAnthropicResponse(response: Anthropic.Message): InvokeResult {
  const textContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
    id: b.id,
    type: "function",
    function: {
      name: b.name,
      arguments: JSON.stringify(b.input),
    },
  }));

  return {
    id: response.id,
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason:
          response.stop_reason === "end_turn"
            ? "stop"
            : (response.stop_reason ?? null),
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });

  const { messages, tools, toolChoice, tool_choice, maxTokens, max_tokens } =
    params;

  const schema = resolveSchema(params);

  let systemText = extractSystemText(messages);
  if (schema) {
    systemText +=
      `\n\nResponda APENAS com JSON válido que corresponda exatamente ao seguinte schema JSON:\n` +
      JSON.stringify(schema.schema, null, 2) +
      `\n\nNão inclua nenhum texto fora do JSON.`;
  }

  const anthropicMessages = toAnthropicMessages(messages);

  const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL,
    max_tokens: maxTokens ?? max_tokens ?? 32768,
    messages: anthropicMessages,
    ...(systemText.trim() ? { system: systemText.trim() } : {}),
  };

  if (tools && tools.length > 0) {
    requestParams.tools = toAnthropicTools(tools);
  }

  if (toolChoice || tool_choice) {
    const tc = toolChoice ?? tool_choice;
    if (tc === "auto") {
      requestParams.tool_choice = { type: "auto" };
    } else if (tc === "none") {
      requestParams.tool_choice = { type: "none" } as Anthropic.ToolChoiceNone;
    } else if (tc === "required") {
      requestParams.tool_choice = { type: "any" };
    } else if (typeof tc === "object" && "name" in tc) {
      requestParams.tool_choice = { type: "tool", name: (tc as ToolChoiceByName).name };
    } else if (typeof tc === "object" && "type" in tc && tc.type === "function") {
      requestParams.tool_choice = {
        type: "tool",
        name: (tc as ToolChoiceExplicit).function.name,
      };
    }
  }

  const response = await client.messages.create(requestParams);
  return mapAnthropicResponse(response);
}
