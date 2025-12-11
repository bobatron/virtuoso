/**
 * Type declarations for ltx package
 */

declare module 'ltx' {
  export class Element {
    name: string;
    attrs: Record<string, any>;
    children: (Element | string)[];
    
    constructor(name: string, attrs?: Record<string, any>);
    
    c(name: string, attrs?: Record<string, any>): Element;
    t(text: string): Element;
    toString(): string;
    
    static parse(xml: string): Element;
  }
  
  export function parse(xml: string): Element;
  
  export default Element;
}
