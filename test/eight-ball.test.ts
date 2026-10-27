import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EIGHT_BALL_RESPONSES, chooseEightBallResponse } from '../src/modules/utility/eight-ball.js';
import { utilityCommands } from '../src/modules/utility/commands.js';

test('the 8-ball has at least 40 distinct responses', () => {
  assert.ok(EIGHT_BALL_RESPONSES.length >= 40);
  assert.equal(new Set(EIGHT_BALL_RESPONSES).size, EIGHT_BALL_RESPONSES.length);
});

test('the response picker returns the response at the selected index', () => {
  for (let index = 0; index < EIGHT_BALL_RESPONSES.length; index += 1) {
    assert.equal(chooseEightBallResponse(() => index), EIGHT_BALL_RESPONSES[index]);
  }
});

test('the 8ball slash command is registered with a required question option', () => {
  const command = utilityCommands.find((candidate) => candidate.name === '8ball');
  assert.ok(command);

  const payload = command.data.toJSON();
  assert.equal(payload.name, '8ball');
  assert.equal(payload.options?.[0]?.name, 'question');
  assert.equal(payload.options?.[0]?.required, true);
});
