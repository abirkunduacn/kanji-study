import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readingsOf } from '../../js/data.js';
import { availableTypes, buildQuiz, kanjiQuestion, meaningQuestion, readingLabel, readingQuestion, reviewQuestions, wordQuestion } from '../../js/quiz.js';
import { makeRng } from '../../js/util.js';
import { fixtureData } from './fixture.mjs';

const data = fixtureData();

function assertWellFormed(question) {
  const correct = question.choices.filter((c) => c.correct);
  assert.equal(correct.length, 1, 'exactly one correct choice');
  assert.equal(correct[0].label, question.answer);
  assert.equal(new Set(question.choices.map((c) => c.label)).size, question.choices.length, 'choices are unique');
  assert.ok(question.choices.length >= 2);
}

describe('Quiz questions', () => {
  test('QUZ001 kanji-to-meaning questions have one correct, unique answer', () => {
    for (let seed = 1; seed < 20; seed += 1) {
      const question = meaningQuestion('休', data, makeRng(seed));
      assertWellFormed(question);
      assert.equal(question.answer, 'rest, day off');
      assert.equal(question.prompt.text, '休');
    }
  });

  test('QUZ002 meaning-to-kanji questions offer look-alike kanji first', () => {
    const question = kanjiQuestion('林', data, makeRng(3));
    assertWellFormed(question);
    assert.equal(question.answer, '林');
    const labels = question.choices.map((c) => c.label);
    assert.ok(labels.some((l) => ['休', '本', '森'].includes(l)), 'includes a kanji sharing 木');
  });

  test('QUZ003 reading questions never offer another reading of the same kanji as a wrong answer', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const question = readingQuestion('日', data, makeRng(seed));
      assertWellFormed(question);
      const own = readingsOf(data.kanji.日);
      for (const choice of question.choices.filter((c) => !c.correct)) {
        assert.ok(!own.has(choice.label.replace(/[()]/g, '')), `${choice.label} is a reading of 日`);
      }
    }
  });

  test('QUZ004 kun readings show okurigana in brackets', () => {
    assert.equal(readingLabel('kun', { r: 'やす', okuri: ['む'] }), 'やす(む)');
    assert.equal(readingLabel('on', { r: 'きゅう', okuri: [] }), 'きゅう');
  });

  test('QUZ005 word questions swap the highlighted part of the reading to make wrong answers', () => {
    const question = wordQuestion('休', data, makeRng(5));
    assertWellFormed(question);
    assert.ok(['休日', '休む'].includes(question.prompt.text));
    for (const choice of question.choices.filter((c) => !c.correct)) assert.notEqual(choice.label, question.answer);
  });

  test('QUZ006 word questions are only offered when a word has a highlighted reading', () => {
    assert.ok(availableTypes('休', data).includes('word'));
    assert.ok(!availableTypes('本', data).includes('word'));
  });

  test('QUZ007 a quiz has the requested length and cycles through the chosen types', () => {
    const questions = buildQuiz(['日', '木', '人'], ['meaning', 'reading'], 6, data, makeRng(9));
    assert.equal(questions.length, 6);
    assert.deepEqual(new Set(questions.map((q) => q.type)), new Set(['meaning', 'reading']));
    assert.deepEqual(buildQuiz([], ['meaning'], 5, data, makeRng(1)), []);
  });

  test('QUZ008 a review asks about the meaning and then a reading of the same kanji', () => {
    const [first, second] = reviewQuestions('森', data, makeRng(2));
    assert.equal(first.type, 'meaning');
    assert.ok(['reading', 'word'].includes(second.type));
    assert.equal(first.char, '森');
    assert.equal(second.char, '森');
  });
});
