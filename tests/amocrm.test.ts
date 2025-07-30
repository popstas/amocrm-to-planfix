import { describe, it, expect } from 'vitest';
import { applyProjectByTag, applyProjectByPipeline, applyProjectByTitle, applyProjectByUtmMedium, applyProjectByUtmCampaign } from '../src/handlers/amocrm.ts';

describe('applyProjectByTag', () => {
  it('sets project based on tag mapping', () => {
    const params: any = { tags: ['tagX', 'other'] };
    const projectTags = { tagX: 'Project X' };
    applyProjectByTag(params, projectTags);
    expect(params.project).toBe('Project X');
  });

  it('matches tag names case-insensitively', () => {
    const params: any = { tags: ['TAGx'] };
    const projectTags = { tagx: 'Project X' };
    applyProjectByTag(params, projectTags);
    expect(params.project).toBe('Project X');
  });

  it('handles mixed case for config key and tag value', () => {
    const params: any = { tags: ['taG1'] };
    const projectTags = { TAG1: 'Project 1' };
    applyProjectByTag(params, projectTags);
    expect(params.project).toBe('Project 1');
  });

  it('matches cyrillic look-alike letters in tags', () => {
    const params: any = { tags: ['tagХ'] };
    const projectTags = { tagx: 'Project X' };
    applyProjectByTag(params, projectTags);
    expect(params.project).toBe('Project X');
  });

  it('leaves project unchanged when no tag matches', () => {
    const params: any = { tags: ['none'], project: 'Keep' };
    const projectTags = { tagX: 'Project X' };
    applyProjectByTag(params, projectTags);
    expect(params.project).toBe('Keep');
  });
});

describe('applyProjectByPipeline', () => {
  it('overrides project based on pipeline', () => {
    const params: any = { pipeline: 'Sales', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectByPipeline(params, map);
    expect(params.project).toBe('SalesProj');
  });

  it('matches pipeline names case-insensitively', () => {
    const params: any = { pipeline: 'sales', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectByPipeline(params, map);
    expect(params.project).toBe('SalesProj');
  });

  it('handles mixed case for config key and pipeline value', () => {
    const params: any = { pipeline: 'piPeliNe', project: 'Old' };
    const map = { PipeLine: 'MappedProj' };
    applyProjectByPipeline(params, map);
    expect(params.project).toBe('MappedProj');
  });

  it('matches cyrillic look-alike letters in pipeline name', () => {
    const params: any = { pipeline: '1000Х', project: 'Old' };
    const map = { '1000x': '1000x' };
    applyProjectByPipeline(params, map);
    expect(params.project).toBe('1000x');
  });

  it('ignores when pipeline not mapped', () => {
    const params: any = { pipeline: 'Other', project: 'Old' };
    const map = { Sales: 'SalesProj' };
    applyProjectByPipeline(params, map);
    expect(params.project).toBe('Old');
  });
});

describe('applyProjectByTitle', () => {
  it('sets project based on lead title', () => {
    const params: any = {};
    const map = { Lead: 'TitleProj' };
    applyProjectByTitle(params, 'Lead created', map);
    expect(params.project).toBe('TitleProj');
  });

  it('matches title case-insensitively', () => {
    const params: any = {};
    const map = { leAd: 'TitleProj' };
    applyProjectByTitle(params, 'lead form', map);
    expect(params.project).toBe('TitleProj');
  });

  it('leaves project when no title matches', () => {
    const params: any = { project: 'Keep' };
    const map = { abc: 'Proj' };
    applyProjectByTitle(params, 'other', map);
    expect(params.project).toBe('Keep');
  });
});

describe('applyProjectByUtmMedium', () => {
  it('sets project based on utm medium', () => {
    const params: any = { fields: { utm_medium: 'Med' } };
    const map = { med: 'MedProj' };
    applyProjectByUtmMedium(params, map);
    expect(params.project).toBe('MedProj');
  });

  it('matches medium names case-insensitively', () => {
    const params: any = { fields: { utm_medium: 'MED' } };
    const map = { med: 'MedProj' };
    applyProjectByUtmMedium(params, map);
    expect(params.project).toBe('MedProj');
  });

  it('ignores when medium not mapped', () => {
    const params: any = { fields: { utm_medium: 'other' }, project: 'Keep' };
    const map = { med: 'MedProj' };
    applyProjectByUtmMedium(params, map);
    expect(params.project).toBe('Keep');
  });
});

describe('applyProjectByUtmCampaign', () => {
  it('sets project when campaign includes key', () => {
    const params: any = { fields: { utm_campaign: 'my-camp' } };
    const map = { camp: 'CampProj' };
    applyProjectByUtmCampaign(params, map);
    expect(params.project).toBe('CampProj');
  });

  it('matches campaign names case-insensitively', () => {
    const params: any = { fields: { utm_campaign: 'SALE-CAMP' } };
    const map = { 'sale': 'SaleProj' };
    applyProjectByUtmCampaign(params, map);
    expect(params.project).toBe('SaleProj');
  });

  it('ignores when campaign not mapped', () => {
    const params: any = { fields: { utm_campaign: 'other' }, project: 'Keep' };
    const map = { foo: 'FooProj' };
    applyProjectByUtmCampaign(params, map);
    expect(params.project).toBe('Keep');
  });
});
