import { describe, expect, it } from 'vitest';
import { getAllReasonCodes, getFeedback } from '@/domain/editorModeFeedback';
import { REASON_CODES } from '@/domain/editorModePolicy';

describe('getFeedback', () => {
  it('returns entry for a known reason code', () => {
    const entry = getFeedback(REASON_CODES.STAGING_ONLY_STRUCTURE);
    expect(entry.message).toBeTruthy();
    expect(entry.tooltip).toBeTruthy();
    expect(entry.suggestedAction).toBeTruthy();
  });

  it('returns fallback for unknown reason code', () => {
    const entry = getFeedback('NONEXISTENT_CODE');
    expect(entry.message).toBe('Action not allowed.');
    expect(entry.tooltip).toBe('This action is blocked by the current editor mode.');
    expect(entry.suggestedAction).toBe('Check the current mode and try a different action.');
  });

  it('every known code returns non-empty fields', () => {
    for (const code of getAllReasonCodes()) {
      const entry = getFeedback(code);
      expect(entry.message).toBeTruthy();
      expect(entry.tooltip).toBeTruthy();
      expect(entry.suggestedAction).toBeTruthy();
    }
  });
});

describe('getAllReasonCodes', () => {
  it('returns a non-empty array of reason codes', () => {
    const codes = getAllReasonCodes();
    expect(codes.length).toBeGreaterThan(0);
    expect(codes).toContain(REASON_CODES.STAGING_ONLY_STRUCTURE);
    expect(codes).toContain(REASON_CODES.DIRTY_DRAFT);
  });
});
