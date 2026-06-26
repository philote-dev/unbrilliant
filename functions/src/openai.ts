import OpenAI from "openai"

export interface CompletionRequest {
  system: string
  user: string
  model: string
}

export interface Completer {
  complete(req: CompletionRequest): Promise<string>
}

export function createClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey })
}

export function openAICompleter(client: OpenAI): Completer {
  return {
    async complete({ system, user, model }) {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      })
      return res.choices[0]?.message?.content ?? ""
    },
  }
}
