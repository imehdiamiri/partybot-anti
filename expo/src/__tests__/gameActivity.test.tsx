import React from 'react';
import { act, create } from 'react-test-renderer';
import { activityLabel, GameActivityProvider, useGameActivity, SecondaryPlayerLabel } from '../components/games/GameActivity';

test.each(['results', 'guide', 'difficulty', 'intro', 'spinning', 'leaderboard'])('hides active label during %s', phase => {
  expect(activityLabel(phase)).toBeNull();
});
test('distinguishes handoff, gameplay, group activity and result', () => {
  expect(activityLabel('ready')).toBe('UP NEXT');
  expect(activityLabel('playing')).toBe('NOW PLAYING');
  expect(activityLabel('result')).toBe('TURN RESULT');
  expect(activityLabel('discussion')).toBe('DISCUSSING');
});
function Player({ name, phase }: { name: string; phase: string }) { useGameActivity(name, phase); return <>{name}</>; }
test.each([
  ['Alice', 'playing', 'Alice', null],
  ['Alice', 'ready', 'Alice', null],
  ['Alice', 'playing', 'Bob', 'Bob'],
  ['Alice', 'results', 'Alice', 'Alice'],
])('secondary label preserves necessary identity: %s / %s / %s', async (owner, phase, label, expected) => {
  function Register() { useGameActivity(owner, phase); return null; }
  let screen: any;
  await act(async () => { screen = create(<GameActivityProvider><Register /><SecondaryPlayerLabel name={label}>{label}</SecondaryPlayerLabel></GameActivityProvider>); });
  expect(screen.toJSON()).toBe(expected);
  await act(async () => screen.unmount());
});
test('standalone handoff retains its player name without a shared banner', async () => {
  let screen: any;
  await act(async () => { screen = create(<SecondaryPlayerLabel name="Alice">Alice</SecondaryPlayerLabel>); });
  expect(screen.toJSON()).toBe('Alice');
  await act(async () => screen.unmount());
});
test('turn registration can update and unmount without a render loop', async () => {
  let screen: any;
  await act(async () => { screen = create(<GameActivityProvider><Player name="Alice" phase="playing" /></GameActivityProvider>); });
  await act(async () => { screen.update(<GameActivityProvider><Player name="Bob" phase="ready" /></GameActivityProvider>); });
  expect(screen.toJSON()).toBe('Bob');
  await act(async () => screen.unmount());
});
