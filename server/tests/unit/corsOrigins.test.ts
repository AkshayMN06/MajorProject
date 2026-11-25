import { describe, it, expect } from 'vitest';
import { parseOrigins } from '../../src/config/env';

describe('parseOrigins', () => {
  it('keeps exact origins as strings', () => {
    expect(parseOrigins('http://localhost:5173, https://app.example')).toEqual(['http://localhost:5173', 'https://app.example']);
  });

  it('turns * into a single-label wildcard, nothing broader', () => {
    const [re] = parseOrigins('https://cyberlearn-web-*-major-project-5fef.vercel.app') as RegExp[];
    expect(re.test('https://cyberlearn-web-abc123xyz-major-project-5fef.vercel.app')).toBe(true);
    expect(re.test('https://cyberlearn-web-git-supabase-vercel-preview-major-project-5fef.vercel.app')).toBe(true);
    expect(re.test('https://cyberlearn-web-x.evil.example-major-project-5fef.vercel.app')).toBe(false); // no dots
    expect(re.test('https://evil.example/https://cyberlearn-web-a-major-project-5fef.vercel.app')).toBe(false);
    expect(re.test('https://cyberlearn-web-a-major-project-5fefXvercel.app')).toBe(false); // dot is literal
    expect(re.test('http://cyberlearn-web-a-major-project-5fef.vercel.app')).toBe(false); // scheme fixed
  });
});
