/**
 * Tests for templateStore module
 */

import { loadTemplates, saveTemplate, deleteTemplate } from '../templateStore';
import type { Template } from '../../types/template';

// Mock electron-store before imports
let mockStoreData: Map<string, any> = new Map();

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string, defaultValue: any) => {
      return mockStoreData.has(key) ? mockStoreData.get(key) : defaultValue;
    }),
    set: jest.fn((key: string, value: any) => {
      mockStoreData.set(key, value);
    }),
  }));
});

describe('templateStore', () => {
  beforeEach(() => {
    // Clear all mocks and data before each test
    jest.clearAllMocks();
    mockStoreData = new Map();
  });

  describe('loadTemplates', () => {
    it('should load templates from store', () => {
      const mockTemplates: Template[] = [
        {
          id: 'test-1',
          name: 'Test Template',
          description: 'A test template',
          xml: '<message/>',
        },
      ];

      mockStoreData.set('templates', mockTemplates);

      const result = loadTemplates();

      expect(result).toEqual(mockTemplates);
    });

    it('should return empty array when no templates', () => {
      const result = loadTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('saveTemplate', () => {
    it('should save a new template', () => {
      const newTemplate: Template = {
        id: 'test-1',
        name: 'New Template',
        xml: '<message/>',
      };

      const result = saveTemplate(newTemplate);

      expect(result).toBe(true);
      expect(mockStoreData.get('templates')).toEqual([newTemplate]);
    });

    it('should update existing template', () => {
      const existingTemplate: Template = {
        id: 'test-1',
        name: 'Old Name',
        xml: '<message/>',
      };
      const updatedTemplate: Template = {
        id: 'test-1',
        name: 'New Name',
        xml: '<message to="user"/>',
      };

      mockStoreData.set('templates', [existingTemplate]);

      const result = saveTemplate(updatedTemplate);

      expect(result).toBe(true);
      expect(mockStoreData.get('templates')).toEqual([updatedTemplate]);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete existing template', () => {
      const templates: Template[] = [
        { id: 'test-1', name: 'Template 1', xml: '<message/>' },
        { id: 'test-2', name: 'Template 2', xml: '<presence/>' },
      ];

      mockStoreData.set('templates', templates);

      const result = deleteTemplate('test-1');

      expect(result).toBe(true);
      expect(mockStoreData.get('templates')).toEqual([templates[1]]);
    });

    it('should return false if template not found', () => {
      const templates: Template[] = [
        { id: 'test-1', name: 'Template 1', xml: '<message/>' },
      ];

      mockStoreData.set('templates', templates);

      const result = deleteTemplate('nonexistent');

      expect(result).toBe(false);
    });
  });
});
