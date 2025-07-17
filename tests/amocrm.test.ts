import { describe, it, expect } from 'vitest';
import { applyProjectTags, applyProjectPipelines } from '../src/handlers/amocrm.ts';

describe('applyProjectTags', () => {
  it('sets project based on tag mapping', () => {
    const params: any = { tags: ['tagX', 'other'] };
    const projectTags = { tagX: 'Project X' };
    applyProjectTags(params, projectTags);
    expect(params.project).toBe('Project X');
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

  it('ignores when pipeline not mapped', () => {
    const params: any = { pipeline: 'Other', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectPipelines(params, map);
    expect(params.project).toBe('Old');
  });
});
