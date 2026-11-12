import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/utils/greeting.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { getGreetingPeriod, pickGreeting } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const memory = new Map();
globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } };

test('saudação usa o horário de São Paulo nas mudanças de período', () => {
  for (const [time, period] of [['07:59', 'night'], ['08:00', 'morning'], ['14:59', 'morning'], ['15:00', 'afternoon'], ['20:59', 'afternoon'], ['21:00', 'night']]) {
    assert.equal(getGreetingPeriod(new Date(`2026-10-31T${time}:00Z`)).key, period);
  }
});

test('cada saudação e frase aparece uma vez antes de reiniciar seu ciclo', () => {
  for (const time of ['09:00', '16:00', '22:00']) {
    const date = new Date(`2026-10-31T${time}:00Z`);
    const choices = Array.from({ length: 6 }, () => pickGreeting('Gabriel', date));
    assert.equal(new Set(choices.map(x => x.headline)).size, 6);
    assert.equal(new Set(choices.map(x => x.phrase)).size, 6);
    assert.ok(choices.every(x => x.headline.includes('Gabriel')));
    const next = pickGreeting('Gabriel', date);
    assert.notEqual(next.headline, choices.at(-1).headline);
    assert.notEqual(next.phrase, choices.at(-1).phrase);
  }
});

test('histórico indisponível ou corrompido não impede a saudação', () => {
  memory.set('desmonte.greeting.v2.morning', '{broken');
  assert.ok(pickGreeting('Ana', new Date('2026-10-31T10:00:00Z')).headline.includes('Ana'));
  globalThis.window.localStorage.getItem = () => { throw new Error('disabled'); };
  assert.ok(pickGreeting('Bruno', new Date('2026-10-31T10:00:00Z')).headline.includes('Bruno'));
});
