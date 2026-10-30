import {validateGamePrompts} from './gamePromptValidation.ts';
import {requestGameCompletion} from './gameProvider.ts';
import { games, type GameType, type Prompt } from "./gameEngine.ts";
export async function generateGamePrompts(
  type: GameType,
  level: string,
): Promise<Prompt[]> {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key)
    throw new Error("AI questions are unavailable. Please retry later.");
  const model =
    Deno.env.get("NVIDIA_MODEL") || "nvidia/nemotron-3.5-lightning-30b-a3b";
  const choices = [
    "would_you_rather",
    "this_or_that",
    "love_trivia",
    "never_have_i_ever",
  ].includes(type);
  const instructions =
    type === "truth_dare"
      ? "Alternate Truth and Dare in the type field. Questions and optional safe dares."
      : type === "emoji_charades"
        ? "question must contain only an emoji clue, answer is its simple movie-free everyday meaning."
        : type === "song_lyrics"
          ? "Write ORIGINAL two-line rhyming verses (never existing song lyrics). question is the first line and options are three possible original endings, answer is the rhyming ending."
          : type === "riddle_me"
            ? "Short unambiguous original riddles with one-word answers."
            : type === "never_have_i_ever"
              ? 'Statements beginning Never have I ever. options exactly ["I have","I haven’t"].'
              : type === "love_trivia"
                ? "Fun multiple-choice general relationship and everyday knowledge trivia, no presumed personal facts. Include 3 options and exact answer."
                : type === "story_builder"
                  ? "Original one-sentence story openings, no answers needed."
                  : choices
                    ? "Two appealing concise options; no correct answer."
                    : "Short original conversation prompts, no correct answer.";
  const response = await requestGameCompletion(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: {type:'json_object'},
        messages: [
          {
            role: "system",
            content:
              'Generate opt-in games for a couple. Output ONLY valid JSON {"prompts":[{"question":"...","options":["..."],"answer":"...","type":"..."}]}. Use four distinct, short prompts. Never pressure disclosure or contact third parties. No dangerous activities, humiliating tasks, explicit sexual content, copyrighted lyrics or health advice. Every prompt can be skipped.',
          },
          {
            role: "user",
            content: `Game: ${games[type][0]}. Level: ${level} (${level === "bold" ? "more adventurous, flirty and emotionally candid, still non-explicit and respectful" : level === "playful" ? "funny and imaginative" : "warm, easy and low pressure"}). ${instructions}`,
          },
        ],
        max_tokens: 900,
        temperature: 0.95,
        ...(model.startsWith("nvidia/nemotron-")
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
      }),
    },
  );
  if (!response.ok) throw new Error("AI questions are temporarily unavailable");
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("AI returned an incomplete set. Please retry.");
  }
  if (!Array.isArray(parsed.prompts))
    throw new Error("AI returned an invalid set");
  const prompts=validateGamePrompts(type,parsed.prompts);
  if (prompts.length < 3)
    throw new Error("Not enough usable AI questions. Please retry.");
  return prompts;
}
