import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_STAGE, SRS_INTERVALS_HOURS } from '../../js/config.js';
import { dueChars, forecast, gradeCard, intervalHours, isDue, nextDue, stageCounts, stageGroup, startCard } from '../../js/srs.js';
import { startOfDay } from '../../js/util.js';

const HOUR = 3600 * 1000;
const NOW = new Date(2026, 10, 24, 9, 0, 0).getTime();

describe('SRS scheduling', () => {
  test('SRS001 a new card starts at stage 1 and is due after the first interval', () => {
    const card = startCard(NOW);
    assert.equal(card.stage, 1);
    assert.equal(card.due, NOW + SRS_INTERVALS_HOURS[1] * HOUR);
    assert.equal(card.reviews, 0);
  });

  test('SRS002 "good" moves a card up one stage and "easy" two', () => {
    const card = startCard(NOW, 3);
    assert.equal(gradeCard(card, 'good', NOW).stage, 4);
    assert.equal(gradeCard(card, 'easy', NOW).stage, 5);
  });

  test('SRS003 "again" drops one stage below stage 5 and two from stage 5 up, never below 1', () => {
    assert.equal(gradeCard(startCard(NOW, 3), 'again', NOW).stage, 2);
    assert.equal(gradeCard(startCard(NOW, 6), 'again', NOW).stage, 4);
    assert.equal(gradeCard(startCard(NOW, 1), 'again', NOW).stage, 1);
  });

  test('SRS004 "again" counts a lapse and every grade counts a review', () => {
    const graded = gradeCard(startCard(NOW, 2), 'again', NOW);
    assert.equal(graded.lapses, 1);
    assert.equal(graded.reviews, 1);
    assert.equal(graded.last, NOW);
  });

  test('SRS005 stages never go past the maximum', () => {
    const top = gradeCard(startCard(NOW, MAX_STAGE), 'easy', NOW);
    assert.equal(top.stage, MAX_STAGE);
    assert.equal(top.due, NOW + intervalHours(MAX_STAGE) * HOUR);
  });

  test('SRS006 due cards are listed oldest first', () => {
    const cards = { 木: { stage: 2, due: NOW - 10 }, 日: { stage: 1, due: NOW - 100 }, 人: { stage: 1, due: NOW + 100 } };
    assert.deepEqual(dueChars(cards, NOW), ['日', '木']);
    assert.equal(isDue(cards.人, NOW), false);
    assert.equal(isDue(undefined, NOW), false);
    assert.equal(nextDue(cards, NOW), NOW + 100);
  });

  test('SRS007 forecast puts overdue cards on today and ignores cards beyond the window', () => {
    const tomorrow = startOfDay(NOW) + 24 * HOUR + HOUR;
    const cards = { a: { stage: 1, due: NOW - HOUR }, b: { stage: 1, due: NOW + HOUR }, c: { stage: 1, due: tomorrow }, d: { stage: 1, due: NOW + 30 * 24 * HOUR } };
    const days = forecast(cards, NOW, 7);
    assert.equal(days.length, 7);
    assert.equal(days[0].count, 2);
    assert.equal(days[1].count, 1);
    assert.equal(days.reduce((sum, d) => sum + d.count, 0), 3);
  });

  test('SRS008 stage groups and counts cover new and started kanji', () => {
    assert.equal(stageGroup(undefined).id, 'new');
    assert.equal(stageGroup({ stage: 2 }).id, 'learning');
    assert.equal(stageGroup({ stage: 8 }).id, 'mastered');
    const counts = stageCounts(['日', '木', '人'], { 日: { stage: 7 }, 木: { stage: 3 } });
    assert.deepEqual(counts, { new: 1, learning: 0, familiar: 1, strong: 0, mastered: 1 });
  });
});
