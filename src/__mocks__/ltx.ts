/**
 * Mock for ltx package
 */

// Mock Element class
export class Element {
  name: string;
  attrs: Record<string, any>;
  children: any[];

  constructor(name: string, attrs?: Record<string, any>) {
    this.name = name;
    this.attrs = attrs || {};
    this.children = [];
  }

  c(name: string, attrs?: Record<string, any>): Element {
    const child = new Element(name, attrs);
    this.children.push(child);
    return child;
  }

  t(text: string): Element {
    this.children.push(text);
    return this;
  }

  toString(): string {
    return `<${this.name} />`;
  }

  static parse(xml: string): Element {
    return new Element('parsed');
  }
}

// Mock parse function
export const parse = jest.fn((xml: string) => {
  return new Element('parsed');
});

export default {
  Element,
  parse,
};
