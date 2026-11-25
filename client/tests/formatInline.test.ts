import { describe, it, expect } from 'vitest';
import { formatInline } from '../src/utils/formatInline';

// Lesson text is rendered with dangerouslySetInnerHTML; teacher-authored and
// uploaded material is untrusted, so markup must come out inert.
describe('formatInline', () => {
  it('keeps the supported **bold** formatting', () => {
    expect(formatInline('Use **least privilege** always')).toBe('Use <strong class="text-white">least privilege</strong> always');
  });

  it('escapes HTML so injected markup is shown as text, not executed', () => {
    const out = formatInline('<img src=x onerror="alert(1)"> & <script>x</script>');
    expect(out).not.toMatch(/<img|<script/);
    expect(out).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;script&gt;x&lt;/script&gt;');
  });

  it('escapes inside bold too', () => {
    expect(formatInline('**<b>x</b>**')).toBe('<strong class="text-white">&lt;b&gt;x&lt;/b&gt;</strong>');
  });
});
