/** Pure, server-authoritative rules. Only `state` is broadcast. `secret` never
 * leaves the service role. Every accepted action consumes one room revision. */
export const games = {
  tictactoe: ["Tic Tac Toe", "tictactoe"],
  dots_boxes: ["Dots & Boxes", "dots-boxes"],
  connect_four: ["Connect Four", "connect-four"],
  rps: ["Rock Paper Scissors", "rps"],
  hangman: ["Hangman", "hangman"],
  wordguess: ["Word Guess", "wordle"],
  love_trivia: ["Love Trivia", "trivia"],
  truth_dare: ["Truth or Dare", "truth-dare"],
  would_you_rather: ["Would You Rather", "would-you-rather"],
  this_or_that: ["This or That", "this-or-that"],
  twenty_questions: ["20 Questions", "20-questions"],
  emoji_charades: ["Emoji Charades", "emoji-charades"],
  memory_match: ["Memory Match", "memory"],
  story_builder: ["Story Builder", "story-builder"],
  riddle_me: ["Riddle Me", "riddle-me"],
  never_have_i_ever: ["Never Have I Ever", "never-have-i-ever"],
  two_truths: ["Two Truths & a Lie", "two-truths"],
  rapid_fire: ["Rapid Fire", "rapid-fire"],
  song_lyrics: ["Finish the Verse", "song-lyrics"],
} as const;
export type GameType = keyof typeof games;
export type Player = "X" | "O";
export type Prompt = {
  question: string;
  options?: string[];
  answer?: string;
  type?: string;
};
export interface State {
  phase: "setup" | "play" | "reveal" | "result";
  turn: Player;
  round: number;
  total: number;
  level: "gentle" | "playful" | "bold";
  scores: Record<Player, number>;
  ready: Player[];
  board: (string | null)[];
  moves: number;
  prompt?: Prompt;
  result?: string;
  winner?: Player | "draw" | "together";
  answer?: string;
  guesses: string[];
  feed: { player: Player; text: string }[];
  revealed: number[];
  matched: number[];
  edges: Record<string, Player>;
  boxes: Record<string, Player>;
  replies: Partial<Record<Player, string>>;
  remaining?: number;
  promptCount?: number;
}
export interface Secret {
  word?: string;
  answer?: string;
  deck?: string[];
  choices: Partial<Record<Player, string>>;
  prompts: Prompt[];
  lie?: number;
}
export function initialGame(type: GameType): { state: State; secret: Secret } {
  return {
    state: {
      phase: "setup",
      turn: "X",
      round: 1,
      total: 5,
      level: "gentle",
      scores: { X: 0, O: 0 },
      ready: [],
      board: Array(
        type === "connect_four" ? 42 : type === "tictactoe" ? 9 : 16,
      ).fill(null),
      moves: 0,
      guesses: [],
      feed: [],
      revealed: [],
      matched: [],
      edges: {},
      boxes: {},
      replies: {},
    },
    secret: { choices: {}, prompts: [] },
  };
}
export function needsPrompts(type: GameType) {
  return [
    "love_trivia",
    "truth_dare",
    "would_you_rather",
    "this_or_that",
    "emoji_charades",
    "story_builder",
    "riddle_me",
    "never_have_i_ever",
    "rapid_fire",
    "song_lyrics",
  ].includes(type);
}
const other = (player: Player): Player => (player === "X" ? "O" : "X");
const clean = (value: unknown, max = 300) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function finish(state: State, winner: State["winner"], message: string) {
  state.phase = "result";
  state.winner = winner;
  state.result = message;
}
function reveal(state: State, secret: Secret, message: string) {
  state.phase = "reveal";
  state.result = message;
  state.replies = { ...secret.choices };
  secret.choices = {};
}
function nextPrompt(state: State, secret: Secret, type: GameType) {
  const prompt = secret.prompts.shift();
  assert(
    prompt,
    "New AI questions are still being prepared. Retry in a moment.",
  );
  secret.answer = prompt.answer;
  state.prompt = {
    question: prompt.question,
    options: prompt.options,
    type: prompt.type,
  };
  if (type === "emoji_charades")
    state.prompt = { question: prompt.question, type: "Guess the emoji clue" };
  state.phase = "play";
}
export function wordFeedback(guess: string, word: string) {
  const result = Array(word.length).fill("absent");
  const counts: Record<string, number> = {};
  for (let i = 0; i < word.length; i++)
    if (guess[i] === word[i]) result[i] = "correct";
    else counts[word[i]] = (counts[word[i]] || 0) + 1;
  for (let i = 0; i < word.length; i++)
    if (result[i] !== "correct" && (counts[guess[i]] || 0) > 0) {
      result[i] = "present";
      counts[guess[i]]--;
    }
  return result;
}
export function play(
  type: GameType,
  input: State,
  hidden: Secret,
  player: Player,
  action: Record<string, unknown>,
  random = Math.random,
): { state: State; secret: Secret } {
  const state = structuredClone(input),
    secret = structuredClone(hidden);
  const kind = clean(action.kind, 30);
  if (kind === "configure") {
    assert(state.phase === "setup", "The game has already started");
    assert(player === "X", "The host chooses the game settings");
    assert(
      ["gentle", "playful", "bold"].includes(String(action.level)),
      "Choose a valid level",
    );
    assert(
      [3, 5, 10].includes(Number(action.total)),
      "Choose 3, 5 or 10 rounds",
    );
    state.level = action.level as State["level"];
    state.total = Number(action.total);
    secret.prompts = [];
    state.ready = [];
    return { state, secret };
  }
  if (kind === "ready") {
    assert(state.phase === "setup", "Already started");
    if (!state.ready.includes(player)) state.ready.push(player);
    if (state.ready.length === 2) {
      state.phase = "play";
      if (type === "memory_match") {
        secret.deck = [
          "heart",
          "moon",
          "leaf",
          "sun",
          "flower",
          "star",
          "cloud",
          "gift",
        ].flatMap((x) => [x, x]);
        for (let i = 15; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [secret.deck[i], secret.deck[j]] = [secret.deck[j], secret.deck[i]];
        }
      }
      if (needsPrompts(type)) nextPrompt(state, secret, type);
    }
    return { state, secret };
  }
  assert(
    state.phase !== "setup" && state.phase !== "result",
    "This round is not accepting moves",
  );
  if (kind === "skip" || kind === "next") {
    assert(
      kind === "skip" || state.phase === "reveal",
      "Finish the current round first",
    );
    if (state.round >= state.total) {
      const winner =
        state.scores.X === state.scores.O
          ? "draw"
          : state.scores.X > state.scores.O
            ? "X"
            : "O";
      finish(
        state,
        [
          "story_builder",
          "truth_dare",
          "would_you_rather",
          "this_or_that",
          "never_have_i_ever",
          "rapid_fire",
        ].includes(type)
          ? "together"
          : winner,
        "A little closer, one round at a time.",
      );
      return { state, secret };
    }
    state.round++;
    state.phase = "play";
    state.turn = other(state.turn);
    state.guesses = [];
    state.replies = {};
    state.result = undefined;
    state.answer = undefined;
    state.prompt = undefined;
    secret.word = undefined;
    secret.answer = undefined;
    secret.lie = undefined;
    secret.choices = {};
    state.remaining = undefined;
    if (type !== "story_builder") state.feed = [];
    if (needsPrompts(type)) nextPrompt(state, secret, type);
    return { state, secret };
  }
  assert(state.phase === "play", "Continue to the next round");
  if (type === "tictactoe" || type === "connect_four") {
    assert(state.turn === player, "It is your partner’s turn");
    let index = Number(action.index);
    assert(Number.isInteger(index), "Choose a cell");
    if (type === "connect_four") {
      assert(index >= 0 && index < 7, "Choose a column");
      let row = 5;
      while (row >= 0 && state.board[row * 7 + index]) row--;
      assert(row >= 0, "That column is full");
      index = row * 7 + index;
    }
    assert(
      index >= 0 && index < state.board.length && !state.board[index],
      "Choose an empty cell",
    );
    state.board[index] = player;
    state.moves++;
    const columns = type === "connect_four" ? 7 : 3,
      rows = type === "connect_four" ? 6 : 3,
      needed = type === "connect_four" ? 4 : 3;
    const win = state.board.some(
      (cell, i) =>
        cell === player &&
        [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, -1],
        ].some(([dr, dc]) =>
          Array.from({ length: needed }, (_, n) => {
            const row = Math.floor(i / columns) + dr * n,
              col = (i % columns) + dc * n;
            return (
              row >= 0 &&
              row < rows &&
              col >= 0 &&
              col < columns &&
              state.board[row * columns + col] === player
            );
          }).every(Boolean),
        ),
    );
    if (win) {
      state.scores[player]++;
      finish(state, player, `${player} made ${needed} in a row!`);
    } else if (state.board.every(Boolean))
      finish(state, "draw", "A perfectly matched round.");
    else state.turn = other(player);
  } else if (type === "dots_boxes") {
    assert(state.turn === player, "It is your partner’s turn");
    const edge = clean(action.edge, 10);
    assert(/^[hv]-[0-3]-[0-3]$/.test(edge), "Choose an edge");
    const [orientation, r, c] = edge.split("-");
    const row = Number(r),
      col = Number(c);
    assert(orientation === "h" ? col < 3 : row < 3, "Invalid edge");
    assert(!state.edges[edge], "That line is already drawn");
    state.edges[edge] = player;
    let claimed = 0;
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const id = `${y}-${x}`;
        if (
          !state.boxes[id] &&
          [
            `h-${y}-${x}`,
            `h-${y + 1}-${x}`,
            `v-${y}-${x}`,
            `v-${y}-${x + 1}`,
          ].every((e) => state.edges[e])
        ) {
          state.boxes[id] = player;
          state.scores[player]++;
          claimed++;
        }
      }
    if (Object.keys(state.boxes).length === 9)
      finish(
        state,
        state.scores.X === state.scores.O
          ? "draw"
          : state.scores.X > state.scores.O
            ? "X"
            : "O",
        "All nine boxes are filled.",
      );
    else if (!claimed) state.turn = other(player);
  } else if (type === "memory_match") {
    assert(state.turn === player, "It is your partner’s turn");
    const index = Number(action.index);
    assert(
      Number.isInteger(index) && index >= 0 && index < 16,
      "Choose a card",
    );
    if (state.revealed.length === 2) {
      state.revealed.forEach((i) => {
        if (!state.matched.includes(i)) state.board[i] = null;
      });
      state.revealed = [];
    }
    assert(
      !state.matched.includes(index) && !state.revealed.includes(index),
      "Choose a face-down card",
    );
    assert(secret.deck?.length === 16, "The deck is unavailable");
    state.board[index] = secret.deck[index];
    state.revealed.push(index);
    if (state.revealed.length === 2) {
      const [a, b] = state.revealed;
      if (secret.deck[a] === secret.deck[b]) {
        state.matched.push(a, b);
        state.scores[player]++;
        state.revealed = [];
      } else state.turn = other(player);
    }
    if (state.matched.length === 16)
      finish(
        state,
        state.scores.X === state.scores.O
          ? "draw"
          : state.scores.X > state.scores.O
            ? "X"
            : "O",
        "Every pair found!",
      );
  } else if (type === "rps") {
    const choice = clean(action.text, 20);
    assert(
      ["rock", "paper", "scissors"].includes(choice),
      "Choose rock, paper or scissors",
    );
    assert(!secret.choices[player], "Your choice is already locked");
    secret.choices[player] = choice;
    state.replies[player] = "Locked";
    if (secret.choices.X && secret.choices.O) {
      const x = secret.choices.X,
        o = secret.choices.O;
      const winner =
        x === o
          ? null
          : { rock: "scissors", paper: "rock", scissors: "paper" }[x] === o
            ? "X"
            : "O";
      if (winner) state.scores[winner]++;
      reveal(
        state,
        secret,
        winner ? `${winner} wins this round` : "Same choice — a tie!",
      );
    }
  } else if (
    ["hangman", "wordguess", "twenty_questions", "two_truths"].includes(type)
  ) {
    const setter = state.turn,
      guesser = other(setter);
    if (kind === "secret") {
      assert(player === setter && !secret.word, "Your partner sets the secret");
      if (type === "two_truths") {
        const statements = action.statements;
        assert(
          Array.isArray(statements) &&
            statements.length === 3 &&
            statements.every(
              (x) =>
                typeof x === "string" &&
                x.trim().length >= 2 &&
                x.length <= 180,
            ),
          "Write three short statements",
        );
        const lie = Number(action.lie);
        assert(Number.isInteger(lie) && lie >= 0 && lie < 3, "Select the lie");
        secret.lie = lie;
        secret.word = "ready";
        state.prompt = {
          question: "Which statement is the lie?",
          options: statements as string[],
        };
      } else {
        const word = clean(action.text, 80);
        assert(
          type === "wordguess"
            ? /^[a-zA-Z]{5}$/.test(word)
            : type === "hangman"
              ? /^[a-zA-Z]{3,16}$/.test(word)
              : word.length >= 2,
          "Use a valid word (Word Guess needs 5 letters; Hangman needs 3–16 letters)",
        );
        secret.word = word.toUpperCase();
        state.prompt = {
          question:
            type === "twenty_questions"
              ? "Ask a yes/no question or make a guess."
              : type === "wordguess"
                ? "Guess the five-letter word."
                : secret.word.replace(/[A-Z]/g, "_"),
        };
        state.remaining = type === "twenty_questions" ? 20 : 6;
      }
    } else {
      assert(secret.word, "Your partner is choosing the secret");
      if (type === "two_truths") {
        assert(player === guesser, "Your partner guesses");
        const index = Number(action.index);
        assert(
          Number.isInteger(index) && index >= 0 && index < 3,
          "Choose a statement",
        );
        const correct = index === secret.lie;
        if (correct) state.scores[guesser]++;
        else state.scores[setter]++;
        state.answer = `The lie was: ${state.prompt?.options?.[secret.lie!]}`;
        reveal(
          state,
          secret,
          correct ? "You spotted it!" : "A convincing storyteller!",
        );
      } else if (kind === "question") {
        assert(
          type === "twenty_questions" && player === guesser,
          "Only the guesser can ask",
        );
        assert(
          !state.feed.length || state.feed.at(-1)?.player === setter,
          "Wait for an answer",
        );
        assert(
          (state.remaining || 0) > 0,
          "No questions left — make a final guess",
        );
        const text = clean(action.text);
        assert(text, "Write a question");
        state.feed.push({ player, text });
        state.remaining!--;
      } else if (kind === "answer") {
        assert(
          type === "twenty_questions" &&
            player === setter &&
            state.feed.at(-1)?.player === guesser,
          "Wait for a question",
        );
        const text = clean(action.text, 20);
        assert(
          ["Yes", "No", "Sometimes"].includes(text),
          "Choose yes, no or sometimes",
        );
        state.feed.push({ player, text });
      } else {
        assert(player === guesser, "Your partner guesses");
        const guess = clean(action.text, 80).toUpperCase();
        assert(guess, "Enter a guess");
        if (type === "hangman") {
          assert(
            /^[A-Z]$/.test(guess) && !state.guesses.includes(guess),
            "Choose a new letter",
          );
          state.guesses.push(guess);
          state.prompt!.question = secret.word
            .split("")
            .map((x) => (state.guesses.includes(x) ? x : "_"))
            .join(" ");
          state.remaining =
            6 - state.guesses.filter((x) => !secret.word!.includes(x)).length;
          const won = secret.word
            .split("")
            .every((x) => state.guesses.includes(x));
          if (won || state.remaining === 0) {
            state.scores[won ? guesser : setter]++;
            state.answer = secret.word;
            reveal(state, secret, won ? "Word found!" : "A tricky word!");
          }
        } else {
          if (type === "wordguess")
            assert(/^[A-Z]{5}$/.test(guess), "Enter five letters");
          state.guesses.push(guess);
          if (type === "wordguess")
            state.feed.push({
              player,
              text: wordFeedback(guess, secret.word).join(","),
            });
          const won = normalize(guess) === normalize(secret.word);
          state.remaining =
            type === "wordguess" ? 6 - state.guesses.length : state.remaining;
          if (won || state.remaining === 0) {
            state.scores[won ? guesser : setter]++;
            state.answer = secret.word;
            reveal(
              state,
              secret,
              won ? "You found it!" : "The secret is revealed.",
            );
          } else if (type === "twenty_questions")
            state.feed.push({ player, text: `Guess: ${guess} — try again` });
        }
      }
    }
  } else if (type === "story_builder") {
    assert(state.turn === player, "It is your partner’s turn");
    const text = clean(action.text, 240);
    assert(text.length >= 3, "Write a short sentence");
    state.feed.push({ player, text });
    state.turn = other(player);
    state.moves++;
    if (state.moves >= state.total * 2)
      finish(state, "together", "A story only the two of you could write.");
  } else {
    const text = clean(action.text, 300);
    assert(text, "Choose or write an answer");
    assert(!secret.choices[player], "Your answer is locked");
    if (state.prompt?.options?.length)
      assert(
        state.prompt.options.includes(text),
        "Choose one of the displayed options",
      );
    secret.choices[player] = text;
    state.replies[player] = "Locked";
    if (secret.choices.X && secret.choices.O) {
      if (secret.answer) {
        for (const p of ["X", "O"] as Player[])
          if (normalize(secret.choices[p]!) === normalize(secret.answer))
            state.scores[p]++;
        state.answer = secret.answer;
      }
      reveal(
        state,
        secret,
        secret.choices.X === secret.choices.O
          ? "You’re on the same wavelength!"
          : "Two perspectives, one conversation.",
      );
    }
  }
  state.feed = state.feed.slice(-50);
  return { state, secret };
}
