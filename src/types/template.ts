/**
 * Template type definitions for Virtuoso
 */

export interface TemplateField {
  name: string;
  type: 'string' | 'number' | 'boolean';
  label?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  xml: string;
  fields?: TemplateField[];
  values?: Record<string, string | number | boolean>;
}

export type TemplateRecord = Template[];
