import { describe, expect, it } from 'vitest';
import { getChatGPTConversationId } from '../src/domain/conversation';

describe('ChatGPT conversation URL', () => {
  it.each([
    ['https://chatgpt.com/c/abc123', 'abc123'],
    ['https://chatgpt.com/c/abc-123', 'abc-123'],
    ['https://chatgpt.com/c/abc-123/?model=test#latest', 'abc-123'],
    ['https://chatgpt.com/', null],
    ['https://chatgpt.com/c/', null],
    ['https://chatgpt.com/c/abc/other', null],
    ['https://chatgpt.com/share/abc', null],
    ['https://example.com/c/abc', null],
    ['https://chatgpt.com.evil.test/c/abc', null],
    ['https://chatgpt.com@evil.test/c/abc', null],
    ['http://chatgpt.com/c/abc', null],
    ['https://chatgpt.com:444/c/abc', null],
    ['https://chatgpt.com/c/a%2Fb', null],
    ['chrome://extensions/', null],
    ['', null],
    ['not a url', null],
  ])('%s → %s', (url, expected) => expect(getChatGPTConversationId(url)).toBe(expected));
});
