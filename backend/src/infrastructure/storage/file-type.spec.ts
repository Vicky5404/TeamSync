import { describe, expect, it } from 'vitest';

import { detectFileType, ruleForFileName, sanitizeFileName } from './file-type.js';
import { contentDisposition } from './storage.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n', 'latin1');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe('detectFileType', () => {
  it('accepts files whose content matches the extension', () => {
    expect(detectFileType('shot.PNG', PNG)).toEqual({ mime: 'image/png', extension: 'png' });
    expect(detectFileType('spec.pdf', PDF)).toEqual({ mime: 'application/pdf', extension: 'pdf' });
    expect(detectFileType('report.docx', ZIP)?.mime).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(detectFileType('notes.md', Buffer.from('# Hello ✓', 'utf8'))?.mime).toBe(
      'text/markdown',
    );
  });

  it('rejects spoofed, binary-as-text and active content', () => {
    expect(detectFileType('evil.png', Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(detectFileType('data.csv', Buffer.from([0x61, 0x00, 0x62]))).toBeNull();
    expect(detectFileType('page.html', Buffer.from('<h1>x</h1>'))).toBeNull();
    expect(detectFileType('icon.svg', Buffer.from('<svg/>'))).toBeNull();
    expect(detectFileType('tool.exe', Buffer.from('MZ'))).toBeNull();
    expect(detectFileType('no-extension', PNG)).toBeNull();
  });

  it('restricts avatars to raster images', () => {
    expect(detectFileType('me.png', PNG, { imagesOnly: true })).not.toBeNull();
    expect(detectFileType('me.pdf', PDF, { imagesOnly: true })).toBeNull();
    expect(ruleForFileName('clip.gif', { imagesOnly: true })?.mime).toBe('image/gif');
  });
});

describe('file names', () => {
  it('strips paths and control characters', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\temp\\a\u0000b.txt')).toBe('ab.txt');
    expect(sanitizeFileName('')).toBe('file');
  });

  it('builds a Content-Disposition safe for any name', () => {
    expect(contentDisposition('résumé "final".pdf')).toBe(
      `attachment; filename="r_sum_ _final_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22.pdf`,
    );
  });
});
