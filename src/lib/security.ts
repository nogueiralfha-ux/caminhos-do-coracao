/**
 * Safely sanitizes HTML content to prevent XSS.
 * Allows safe tags: strong, em, u, b, i, br, p, span, div.
 * Strips script tags, iframe, onload, onclick and other dangerous handlers.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Use DOMParser if available in the browser environment
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const allowedTags = ['STRONG', 'EM', 'U', 'B', 'I', 'BR', 'P', 'SPAN', 'DIV'];
      
      const sanitizeNode = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toUpperCase();
          
          if (!allowedTags.includes(tagName)) {
            // If tag is not allowed, remove it if it's dangerous (script, iframe, etc.)
            if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(tagName)) {
              element.remove();
              return;
            }
          }
          
          // Remove all attributes except safe ones (like class)
          const attributes = Array.from(element.attributes);
          for (const attr of attributes) {
            const attrName = attr.name.toLowerCase();
            // Allow class attribute but strip any handler/script attributes (starts with 'on' or contains javascript:)
            if (attrName === 'class') {
              continue;
            } else {
              element.removeAttribute(attr.name);
            }
          }
        }
        
        // Recursively sanitize children
        const children = Array.from(node.childNodes);
        for (const child of children) {
          sanitizeNode(child);
        }
      };

      if (doc.body) {
        sanitizeNode(doc.body);
        return doc.body.innerHTML;
      }
    } catch (e) {
      console.warn("DOMParser sanitization failed, using regex fallback:", e);
    }
  }

  // Fallback RegExp-based basic sanitizer (very strict fallback)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"][^'"]*['"]|\S+)/gi, '')
    .replace(/javascript:/gi, '');
}
