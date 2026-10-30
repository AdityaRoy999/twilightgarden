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
              ? 'Statements beginning Never have I ever. Invent revealing, surprising experiences a person might actually have, WITHOUT assuming the couple did something together. No obvious shared milestones or generic rain/dancing/date questions. options exactly ["I have","I haven’t"].'
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
              'You design memorable opt-in conversation games, not generic icebreakers. Output ONLY valid JSON {"prompts":[{"question":"...","options":["..."],"answer":"...","type":"..."}]}. Use FIVE distinct, short prompts, each with a different surprising premise. Omit options/answer/type when the game does not use them. Mix mischievous dilemmas, unusual confessions, imaginative what-ifs and playful challenges; suit the requested level. Do not presume facts about either player. Avoid repetitive "have you ever danced in the rain", favorite-color, first-date, generic compliments and yes/no filler. Never pressure disclosure, demand proof, involve third parties, alcohol or dangerous or humiliating tasks. No explicit sexual content, copyrighted lyrics or health advice. Romantic prompts must be non-graphic, respectful and easy to decline. Every prompt can be skipped without penalty.',
          },
          {
            role: "user",
            content: `Game: ${games[type][0]}. Level: ${level} (${level === 'after_hours' ? 'Both players have opted into an adults-only round: intimate relationship preferences, attraction, flirty hypotheticals and candid boundaries; NON-GRAPHIC, no sexual acts or explicit descriptions, no obligation to perform anything' : level === "bold" ? "surprising confessions, daring imaginary dilemmas and emotionally candid challenges, still non-explicit and respectful" : level === "playful" ? "mischievous, funny, unpredictable and imaginative" : "warm, curious, specific and low pressure; still original rather than obvious"}). ${instructions}`,
          },
        ],
        max_tokens: 1100,
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
