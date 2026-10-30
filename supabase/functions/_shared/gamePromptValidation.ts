import type {GameType,Prompt} from './gameEngine.ts';

export function validateGamePrompts(type:GameType,input:unknown):Prompt[]{
  if(!Array.isArray(input))return [];
  const choices=['would_you_rather','this_or_that','love_trivia','never_have_i_ever'].includes(type);
  const seen = new Set<string>();
  const prompts: Prompt[] = input
    .filter((p: Prompt) => {
      if (
        !p ||
        typeof p.question !== "string" ||
        p.question.length < 2 ||
        p.question.length > 350 ||
        seen.has(p.question)
      )
        return false;
      if (
        (choices || type === 'song_lyrics') &&
        (!Array.isArray(p.options) ||
          p.options.length < 2 ||
          p.options.length > 4 ||
          !p.options.every(
            (x) => typeof x === "string" && x.length > 0 && x.length <= 160,
          ))
      )
        return false;
      if ((choices || type === "song_lyrics") && !p.options?.length)
        return false;
      if (
        ["love_trivia", "riddle_me", "song_lyrics", "emoji_charades"].includes(
          type,
        ) &&
        (typeof p.answer !== "string" ||
          !p.answer.trim() ||
          p.answer.length > 180)
      )
        return false;
      if (
        ["love_trivia", "song_lyrics"].includes(type) &&
        !p.options?.includes(p.answer!)
      )
        return false;
      seen.add(p.question);
      return true;
    })
    .slice(0, 8)
    .map((p: Prompt) => ({
      question: p.question,
      options: choices || type === "song_lyrics" ? p.options : undefined,
      answer: [
        "love_trivia",
        "riddle_me",
        "song_lyrics",
        "emoji_charades",
      ].includes(type)
        ? p.answer
        : undefined,
      type:
        p.type === "Dare" ? "Dare" : p.type === "Truth" ? "Truth" : undefined,
    }));
  return prompts;
}
