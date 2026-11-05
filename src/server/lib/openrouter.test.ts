import { generateText } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

const completion = () =>
  Response.json({
    choices: [
      {
        message: { role: "assistant", content: "ok" },
        finish_reason: "stop",
      },
    ],
  });

// The egress country is cached per module (one lookup per isolate), so each
// test needs a fresh module to run its own lookup.
beforeEach(() => {
  vi.resetModules();
});

async function requestedModel(trace: () => Promise<Response>) {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementationOnce(trace)
    .mockResolvedValueOnce(completion());
  const { buildChatAgentModel } = await import("./openrouter");
  await generateText({
    model: buildChatAgentModel({ apiKey: "key" }, "openai/gpt-5.6-luna"),
    prompt: "hi",
  });
  const body = z
    .object({ model: z.string() })
    .parse(JSON.parse(z.string().parse(fetchMock.mock.calls[1]?.[1]?.body)));
  return body.model;
}

it("sends OpenAI calls to MiniMax M3 from a country where OpenAI is blocked", async () => {
  expect(
    await requestedModel(async () => new Response("colo=HKG\nloc=HK\n")),
  ).toBe("minimax/minimax-m3");
});

it("sends requests straight to Anthropic with a direct key", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    Response.json({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  );
  const { buildChatAgentModel } = await import("./openrouter");
  await generateText({
    model: buildChatAgentModel({
      anthropicApiKey: "key",
      anthropicModel: "claude-haiku-5-5",
    }),
    prompt: "hi",
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    "https://api.anthropic.com/v1/messages",
  );
});

it("sends requests to a custom base URL without the region lookup", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(completion());
  const { buildChatAgentModel } = await import("./openrouter");
  await generateText({
    model: buildChatAgentModel({
      apiKey: "key",
      baseURL: "https://llm.example.com/v1",
    }),
    prompt: "hi",
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(
    "https://llm.example.com/v1/chat/completions",
    expect.anything(),
  );
});

it("stays on OpenAI when the country lookup fails", async () => {
  expect(
    await requestedModel(async () => {
      throw new Error("offline");
    }),
  ).toBe("openai/gpt-5.6-luna");
});
