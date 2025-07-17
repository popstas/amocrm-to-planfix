import { describe, it, expect } from 'vitest';
import { applyProjectTags, applyProjectPipelines } from '../src/handlers/amocrm.ts';

describe('applyProjectTags', () => {
  it('sets project based on tag mapping', () => {
    const params: any = { tags: ['tagX', 'other'] };
    const projectTags = { tagX: 'Project X' };
    applyProjectTags(params, projectTags);
    expect(params.project).toBe('Project X');
  });

  it('matches tag names case-insensitively', () => {
    const params: any = { tags: ['TAGx'] };
    const projectTags = { tagx: 'Project X' };
    applyProjectTags(params, projectTags);
    expect(params.project).toBe('Project X');
  });

  it('handles mixed case for config key and tag value', () => {
    const params: any = { tags: ['taG1'] };
    const projectTags = { TAG1: 'Project 1' };
    applyProjectTags(params, projectTags);
    expect(params.project).toBe('Project 1');
  });

  it('leaves project unchanged when no tag matches', () => {
    const params: any = { tags: ['none'], project: 'Keep' };
    const projectTags = { tagX: 'Project X' };
    applyProjectTags(params, projectTags);
    expect(params.project).toBe('Keep');
  });
});

describe('applyProjectPipelines', () => {
  it('overrides project based on pipeline', () => {
    const params: any = { pipeline: 'Sales', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectPipelines(params, map);
    expect(params.project).toBe('SalesProj');
  });

  it('matches pipeline names case-insensitively', () => {
    const params: any = { pipeline: 'sales', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectPipelines(params, map);
    expect(params.project).toBe('SalesProj');
  });

  it('handles mixed case for config key and pipeline value', () => {
    const params: any = { pipeline: 'piPeliNe', project: 'Old' };
    const map = { PipeLine: 'MappedProj' };
    applyProjectPipelines(params, map);
    expect(params.project).toBe('MappedProj');
  });

  it('ignores when pipeline not mapped', () => {
    const params: any = { pipeline: 'Other', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectPipelines(params, map);
    expect(params.project).toBe('Old');
  });
});
