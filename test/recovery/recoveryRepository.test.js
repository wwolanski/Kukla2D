// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { isStoredProjectRecord, isValidRecoveryRecord } from '../../src/io/projectDb';

function makeRecord(overrides = {}) {
  return {
    id: 'workspace-recovery',
    archive: new Blob(['test'], { type: 'application/zip' }),
    savedAt: Date.now(),
    sourceProjectId: null,
    sourceProjectName: null,
    documentVersion: 1,
    revision: 1,
    ...overrides,
  };
}

describe('isValidRecoveryRecord', () => {
  it('returns true for valid record', () => {
    expect(isValidRecoveryRecord(makeRecord())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidRecoveryRecord(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidRecoveryRecord(undefined)).toBe(false);
  });

  it('returns false for wrong id', () => {
    expect(isValidRecoveryRecord(makeRecord({ id: 'wrong' }))).toBe(false);
  });

  it('returns false when archive is not Blob', () => {
    expect(isValidRecoveryRecord(makeRecord({ archive: 'not-a-blob' }))).toBe(false);
  });

  it('returns false for missing savedAt', () => {
    expect(isValidRecoveryRecord(makeRecord({ savedAt: undefined }))).toBe(false);
  });

  it('returns false for zero savedAt', () => {
    expect(isValidRecoveryRecord(makeRecord({ savedAt: 0 }))).toBe(false);
  });

  it('returns false for non-finite savedAt', () => {
    expect(isValidRecoveryRecord(makeRecord({ savedAt: Number.NaN }))).toBe(false);
  });

  it('returns false for negative revision', () => {
    expect(isValidRecoveryRecord(makeRecord({ revision: -1 }))).toBe(false);
  });

  it('returns false for non-string sourceProjectId when not null', () => {
    expect(isValidRecoveryRecord(makeRecord({ sourceProjectId: 123 }))).toBe(false);
  });

  it('returns true with string sourceProjectId', () => {
    expect(isValidRecoveryRecord(makeRecord({ sourceProjectId: 'proj-1' }))).toBe(true);
  });

  it('returns false for non-string sourceProjectName when not null', () => {
    expect(isValidRecoveryRecord(makeRecord({ sourceProjectName: 42 }))).toBe(false);
  });

  it('returns true with string sourceProjectName', () => {
    expect(isValidRecoveryRecord(makeRecord({ sourceProjectName: 'My Project' }))).toBe(true);
  });

  it('returns false for non-number revision', () => {
    expect(isValidRecoveryRecord(makeRecord({ revision: '1' }))).toBe(false);
  });

  it('returns false for fractional revision', () => {
    expect(isValidRecoveryRecord(makeRecord({ revision: 1.5 }))).toBe(false);
  });

  it('returns false for invalid documentVersion type', () => {
    expect(isValidRecoveryRecord(makeRecord({ documentVersion: {} }))).toBe(false);
  });
});

describe('isStoredProjectRecord', () => {
  const validRecord = () => ({
    id: 'project-1',
    name: 'Project',
    blob: new Blob(['project']),
    thumbnail: '',
    updatedAt: Date.now(),
    formatId: 'kukla2d.dev/project',
    formatVersion: 1,
    extension: 'kk2d',
  });

  it('accepts a complete library record', () => {
    expect(isStoredProjectRecord(validRecord())).toBe(true);
  });

  it.each([
    ['blob', 'not-a-blob'],
    ['updatedAt', Number.NaN],
    ['formatId', ''],
    ['formatVersion', Number.POSITIVE_INFINITY],
    ['extension', ''],
  ])('rejects invalid %s', (field, value) => {
    expect(isStoredProjectRecord({ ...validRecord(), [field]: value })).toBe(false);
  });
});
