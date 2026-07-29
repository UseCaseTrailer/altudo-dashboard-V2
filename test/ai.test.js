const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildInstructions,
  buildInput,
  extractOutputText,
  normaliseRequest
} = require('../lib/ai');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const route = fs.readFileSync(path.join(root, 'api', 'ai.js'), 'utf8');

test('AI request keeps only bounded conversation and context', () => {
  const request = normaliseRequest({
    mode: 'chat',
    question: 'Why is Project Atlas at risk?',
    context: {asOf: '2026-07-28T10:00:00.000Z', aggregate: {overdueTasks: 12}},
    history: Array.from({length: 12}, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `message ${index}`
    }))
  });

  assert.equal(request.history.length, 8);
  assert.equal(request.context.aggregate.overdueTasks, 12);
  assert.match(buildInput(request), /Why is Project Atlas at risk\?/);
});

test('portfolio analyst prompt requires traceability and missing-data disclosure', () => {
  const instructions = buildInstructions('chat');
  assert.match(instructions, /Traceability is mandatory/);
  assert.match(instructions, /Never invent, backfill, or estimate/);
  assert.match(instructions, /utilization requires capacity and effort/);
  assert.match(instructions, /forecasts are directional/);
});

test('Responses API output text is extracted from both response shapes', () => {
  assert.equal(extractOutputText({output_text: 'Direct text'}), 'Direct text');
  assert.equal(extractOutputText({
    output: [{content: [{type: 'output_text', text: 'Nested text'}]}]
  }), 'Nested text');
});

test('OpenAI route is server-only and uses the Responses API', () => {
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(route, /store:\s*false/);
  assert.doesNotMatch(route, /body\.openai_key|chat\/completions|ANTHROPIC/);
});

test('dashboard exposes ChatGPT with canonical live reporting context', () => {
  assert.match(html, /Ask ChatGPT about live portfolio data/);
  assert.match(html, /function buildChatGPTContext\(\)/);
  assert.match(html, /source:"Asana live reporting model"/);
  assert.match(html, /dataQuality:REPORTING\.dataQuality/);
  assert.match(html, /function callChatGPT\(/);
  assert.doesNotMatch(html, /Claude|Anthropic|sk-ant-|chat\/completions/);
  assert.doesNotMatch(html, /localStorage\.setItem\(AI_KEY_STORAGE/);
});
