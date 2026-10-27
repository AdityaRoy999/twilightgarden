export type PreviewType =
  | "tictactoe"
  | "connectfour"
  | "cards"
  | "chat"
  | "truthdare"
  | "trivia"
  | "drawing";
export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  previewType: PreviewType;
}
export interface GameTutorialConfig {
  gameId: string;
  title: string;
  description: string;
  steps: TutorialStep[];
}
export const tutorialRegistry: Record<string, GameTutorialConfig> = {
  tictactoe: {
    gameId: "tictactoe",
    title: "Tic Tac Toe",
    description: "Open the same game and both tap Ready. You play as X or O.",
    steps: [
      {
        id: 0,
        title: "Join together",
        description:
          "Open the same game and both tap Ready. You play as X or O.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Take turns",
        description:
          "Tap an empty square. A move is saved before the turn passes to your partner.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Make three",
        description:
          "Connect three horizontally, vertically or diagonally. A full board without a line is a draw.",
        previewType: "chat",
      },
    ],
  },
  "connect-four": {
    gameId: "connect-four",
    title: "Connect Four",
    description: "Tap a column. Your disc falls to the lowest available space.",
    steps: [
      {
        id: 0,
        title: "Drop a disc",
        description:
          "Tap a column. Your disc falls to the lowest available space.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Take turns",
        description:
          "Choose an open column and block your partner while building your own line.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Connect four",
        description:
          "Four discs horizontally, vertically or diagonally wins. A full board can be a draw.",
        previewType: "chat",
      },
    ],
  },
  "dots-boxes": {
    gameId: "dots-boxes",
    title: "Dots & Boxes",
    description:
      "Tap between two neighboring dots. You cannot draw the same edge twice.",
    steps: [
      {
        id: 0,
        title: "Draw a line",
        description:
          "Tap between two neighboring dots. You cannot draw the same edge twice.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Close a box",
        description:
          "The fourth side claims that box and gives you another turn.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Count your boxes",
        description:
          "When all nine boxes are filled, the player with more boxes wins.",
        previewType: "chat",
      },
    ],
  },
  rps: {
    gameId: "rps",
    title: "Rock Paper Scissors",
    description:
      "Choose rock, paper or scissors. Your choice stays hidden until both players lock in.",
    steps: [
      {
        id: 0,
        title: "Choose in secret",
        description:
          "Choose rock, paper or scissors. Your choice stays hidden until both players lock in.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Reveal together",
        description:
          "Rock beats scissors, scissors beats paper, and paper beats rock. Matching choices tie.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Finish the rounds",
        description:
          "Play the chosen 3, 5 or 10 rounds. The highest total wins; equal totals draw.",
        previewType: "chat",
      },
    ],
  },
  hangman: {
    gameId: "hangman",
    title: "Hangman",
    description:
      "One partner chooses a word with 3 to 16 letters. The other sees blanks only.",
    steps: [
      {
        id: 0,
        title: "Set a secret",
        description:
          "One partner chooses a word with 3 to 16 letters. The other sees blanks only.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Guess a letter",
        description:
          "Correct letters reveal themselves. Each new wrong letter uses one of six guesses.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Swap roles",
        description:
          "Reveal the word, then take turns setting the next secret. Skip whenever you like.",
        previewType: "chat",
      },
    ],
  },
  wordle: {
    gameId: "wordle",
    title: "Word Guess",
    description:
      "One partner sets a secret five-letter word. The other has six guesses.",
    steps: [
      {
        id: 0,
        title: "Choose a word",
        description:
          "One partner sets a secret five-letter word. The other has six guesses.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Read the clues",
        description:
          "Green means the correct letter and position. Purple means the letter belongs elsewhere. Muted means absent.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Try again",
        description:
          "Repeated letters count only as often as they occur in the secret. Reveal, then swap roles.",
        previewType: "chat",
      },
    ],
  },
  "20-questions": {
    gameId: "20-questions",
    title: "20 Questions",
    description:
      "One partner thinks of a person, place or thing and locks it in.",
    steps: [
      {
        id: 0,
        title: "Keep a secret",
        description:
          "One partner thinks of a person, place or thing and locks it in.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Ask and answer",
        description:
          "The guesser asks up to 20 yes/no questions. The thinker answers Yes, No or Sometimes.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Make a guess",
        description:
          "Enter a guess using the guess button. After question 20, your next guess is final.",
        previewType: "chat",
      },
    ],
  },
  memory: {
    gameId: "memory",
    title: "Memory Match",
    description:
      "Tap two face-down cards on your turn. The shared deck is shuffled for both players.",
    steps: [
      {
        id: 0,
        title: "Flip two cards",
        description:
          "Tap two face-down cards on your turn. The shared deck is shuffled for both players.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Find a pair",
        description:
          "Matching cards stay face up and earn a point. You keep your turn.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Remember the board",
        description:
          "A mismatch passes the turn. Finish all eight pairs; the highest score wins.",
        previewType: "chat",
      },
    ],
  },
  "two-truths": {
    gameId: "two-truths",
    title: "Two Truths & a Lie",
    description:
      "Write two truths and one lie. Mark the lie privately before locking your statements.",
    steps: [
      {
        id: 0,
        title: "Write three statements",
        description:
          "Write two truths and one lie. Mark the lie privately before locking your statements.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Guess the lie",
        description:
          "Your partner picks the statement they think is false. The answer stays hidden until then.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal and swap",
        description:
          "A correct guess scores a point. Otherwise the storyteller scores. Swap roles next round.",
        previewType: "chat",
      },
    ],
  },
  "story-builder": {
    gameId: "story-builder",
    title: "Story Builder",
    description:
      "AI prepares a new story opening. Both players see the same beginning.",
    steps: [
      {
        id: 0,
        title: "An original beginning",
        description:
          "AI prepares a new story opening. Both players see the same beginning.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "One sentence each",
        description:
          "Take turns adding a short sentence. Let your partner build on your ideas.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Made together",
        description:
          "After both players have taken the chosen number of turns, enjoy your complete story.",
        previewType: "chat",
      },
    ],
  },
  "emoji-charades": {
    gameId: "emoji-charades",
    title: "Emoji Charades",
    description: "AI creates a fresh everyday clue written in emoji.",
    steps: [
      {
        id: 0,
        title: "Read the emoji clue",
        description: "AI creates a fresh everyday clue written in emoji.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your guesses",
        description:
          "Both partners type what they think the clue represents. Answers stay locked until both reply.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "See the reveal",
        description:
          "Compare guesses and the intended answer. Skip a confusing clue and try the next one.",
        previewType: "chat",
      },
    ],
  },
  trivia: {
    gameId: "trivia",
    title: "Love Trivia",
    description:
      "Answer a fresh AI question about relationships or everyday knowledge.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description:
          "Answer a fresh AI question about relationships or everyday knowledge.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Choose one option. Your choice stays hidden until both players have replied.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "The reveal shows the correct answer. Correct answers earn a point.",
        previewType: "chat",
      },
    ],
  },
  "truth-dare": {
    gameId: "truth-dare",
    title: "Truth or Dare",
    description:
      "Choose Gentle, Playful or Bold. AI makes fresh truths and safe optional dares ahead of time.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description:
          "Choose Gentle, Playful or Bold. AI makes fresh truths and safe optional dares ahead of time.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Answer a truth or type Done after a dare. Either player can skip without penalty.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "Reveal your replies together and enjoy a conversation at your own pace.",
        previewType: "chat",
      },
    ],
  },
  "would-you-rather": {
    gameId: "would-you-rather",
    title: "Would You Rather",
    description: "AI makes two fresh possibilities based on the chosen mood.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description:
          "AI makes two fresh possibilities based on the chosen mood.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Pick your favorite. Your partner cannot see your choice until both have answered.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "Reveal your choices, talk about why, then continue or skip.",
        previewType: "chat",
      },
    ],
  },
  "this-or-that": {
    gameId: "this-or-that",
    title: "This or That",
    description: "Start with a fresh pair of choices made by AI.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description: "Start with a fresh pair of choices made by AI.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Choose at your own pace. Both answers stay private until locked in.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "See if you match, then start another round. There is no right answer.",
        previewType: "chat",
      },
    ],
  },
  "riddle-me": {
    gameId: "riddle-me",
    title: "Riddle Me",
    description: "Read the same original AI riddle together.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description: "Read the same original AI riddle together.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Write a short answer. Both guesses stay hidden until both are ready.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "The reveal shows the intended answer. Correct answers earn a point.",
        previewType: "chat",
      },
    ],
  },
  "never-have-i-ever": {
    gameId: "never-have-i-ever",
    title: "Never Have I Ever",
    description:
      "Read a fresh statement. The mood sets how playful or candid it feels.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description:
          "Read a fresh statement. The mood sets how playful or candid it feels.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Choose I have or I haven\u2019t. You can skip any statement for any reason.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "Compare experiences only when both have answered. Share as much or as little as you like.",
        previewType: "chat",
      },
    ],
  },
  "rapid-fire": {
    gameId: "rapid-fire",
    title: "Rapid Fire",
    description: "AI prepares short fresh questions before the round starts.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description:
          "AI prepares short fresh questions before the round starts.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description:
          "Type your first thought. There is no countdown or pressure to disclose.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "Reveal together, enjoy your answers and move to the next question.",
        previewType: "chat",
      },
    ],
  },
  "song-lyrics": {
    gameId: "song-lyrics",
    title: "Finish the Verse",
    description:
      "Play with short original verses made by AI, rather than copied song lyrics.",
    steps: [
      {
        id: 0,
        title: "Get comfortable",
        description:
          "Play with short original verses made by AI, rather than copied song lyrics.",
        previewType: "chat",
      },
      {
        id: 1,
        title: "Make your choice",
        description: "Read the opening and choose the ending that rhymes.",
        previewType: "chat",
      },
      {
        id: 2,
        title: "Reveal together",
        description:
          "Reveal the intended ending and your choices. Correct endings earn a point.",
        previewType: "chat",
      },
    ],
  },
};
