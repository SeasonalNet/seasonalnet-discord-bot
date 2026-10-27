import { randomInt } from 'node:crypto';

export const EIGHT_BALL_RESPONSES = [
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes — definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  'Absolutely.',
  'The odds are in your favor.',
  'Count on a favorable outcome.',
  'The answer is looking bright.',
  'A good result is within reach.',
  'You are on the right track.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  'The signs are still forming.',
  'Give it a little more time.',
  'The answer is not clear yet.',
  'Wait for more information.',
  'Try again when the timing is better.',
  'The future is undecided.',
  'Maybe — the details matter.',
  'It is uncertain.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
  'The odds are against it.',
  'That path looks unlikely.',
  'The answer points away from yes.',
  'I would not bet on it.',
  'The signs say no for now.',
  'This does not look promising.',
  'Not likely, but surprises happen.',
  'The universe says: nope.',
  'No — reconsider the plan.',
] as const;

export function chooseEightBallResponse(randomIndex: () => number = () => randomInt(EIGHT_BALL_RESPONSES.length)): string {
  const response = EIGHT_BALL_RESPONSES[randomIndex()];
  if (!response) {
    throw new Error('Eight-ball response index was out of range.');
  }

  return response;
}
