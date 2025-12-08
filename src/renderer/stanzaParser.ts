export interface ParsedField {
    key: string;
    value: string;
    section?: string; // Optional grouping
}

export const parseStanza = (xmlString: string): ParsedField[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const root = doc.documentElement;

    if (root.nodeName === 'parsererror') {
        return [{ key: 'Error', value: 'Invalid XML' }];
    }

    const fields: ParsedField[] = [];

    // 1. Root Attributes
    Array.from(root.attributes).forEach(attr => {
        fields.push({ key: attr.name, value: attr.value });
    });

    // 2. Common Child Elements (Text Content)
    ['body', 'subject', 'thread'].forEach(tagName => {
        const el = root.querySelector(tagName);
        if (el && el.textContent) {
            fields.push({ key: tagName, value: el.textContent });
        }
    });

    // 3. Error Conditions
    const error = root.querySelector('error');
    if (error) {
        const code = error.getAttribute('code');
        const type = error.getAttribute('type');
        if (code) fields.push({ key: 'error-code', value: code, section: 'Error' });
        if (type) fields.push({ key: 'error-type', value: type, section: 'Error' });

        // Find specific error condition (first child element)
        const condition = Array.from(error.children).find(c => c.tagName !== 'text');
        if (condition) {
            fields.push({ key: 'condition', value: condition.tagName, section: 'Error' });
        }

        const text = error.querySelector('text');
        if (text && text.textContent) {
            fields.push({ key: 'error-text', value: text.textContent, section: 'Error' });
        }
    }

    // 4. XEP-0203 Delayed Delivery
    const delay = root.getElementsByTagNameNS('urn:xmpp:delay', 'delay')[0];
    if (delay) {
        const stamp = delay.getAttribute('stamp');
        const from = delay.getAttribute('from');
        if (stamp) fields.push({ key: 'delay-stamp', value: stamp, section: 'Delay' });
        if (from) fields.push({ key: 'delay-from', value: from, section: 'Delay' });
    }

    // 5. XEP-0297 Stanza Forwarding (MAM)
    const forwarded = root.getElementsByTagNameNS('urn:xmpp:forward:0', 'forwarded')[0];
    if (forwarded) {
        // Check for delayed delivery inside forwarded
        const innerDelay = forwarded.getElementsByTagNameNS('urn:xmpp:delay', 'delay')[0];
        if (innerDelay) {
            fields.push({ key: 'orig-stamp', value: innerDelay.getAttribute('stamp') || '', section: 'Forwarded' });
        }

        // Check for message inside forwarded
        const innerMsg = forwarded.getElementsByTagName('message')[0];
        if (innerMsg) {
            const from = innerMsg.getAttribute('from');
            const to = innerMsg.getAttribute('to');
            const type = innerMsg.getAttribute('type');
            const body = innerMsg.querySelector('body')?.textContent;

            if (from) fields.push({ key: 'orig-from', value: from, section: 'Forwarded' });
            if (to) fields.push({ key: 'orig-to', value: to, section: 'Forwarded' });
            if (type) fields.push({ key: 'orig-type', value: type, section: 'Forwarded' });
            if (body) fields.push({ key: 'orig-body', value: body, section: 'Forwarded' });

            // Check for MAM result id (XEP-0313)
            const result = root.getElementsByTagNameNS('urn:xmpp:mam:2', 'result')[0];
            if (result) {
                const id = result.getAttribute('id');
                if (id) fields.push({ key: 'mam-id', value: id, section: 'MAM' });
            }
        }
    }

    // 6. XEP-0030 Service Discovery
    const queryDiscoInfo = root.getElementsByTagNameNS('http://jabber.org/protocol/disco#info', 'query')[0];
    if (queryDiscoInfo) {
        const identities = queryDiscoInfo.getElementsByTagName('identity');
        Array.from(identities).forEach((id, idx) => {
            const category = id.getAttribute('category');
            const type = id.getAttribute('type');
            const name = id.getAttribute('name');
            fields.push({ key: `identity-${idx + 1}`, value: `${category}/${type} (${name || ''})`, section: 'Disco Info' });
        });

        const features = queryDiscoInfo.getElementsByTagName('feature');
        fields.push({ key: 'features-count', value: features.length.toString(), section: 'Disco Info' });
    }

    // 7. Dynamic Traversal (Fallback for unknown fields like RSM)
    // We skip elements already handled specifically above to avoid clutter, 
    // but for now we'll just add everything that looks like a leaf node or has attributes
    // and isn't part of the main "body/subject/thread" set we already grabbed.

    const traverse = (node: Element, section?: string) => {
        // Attributes
        Array.from(node.attributes).forEach(attr => {
            // Skip common namespaces to reduce noise
            if (attr.name === 'xmlns') return;

            // Use a compound key if it's not the root
            const key = node === root ? attr.name : `${node.tagName}-${attr.name}`;

            // Avoid duplicates if we already have this key in the same section (or no section)
            if (!fields.some(f => f.key === key && f.value === attr.value)) {
                fields.push({ key, value: attr.value, section: section || node.tagName });
            }
        });

        // Text Content (Leaf Nodes)
        if (node.children.length === 0 && node.textContent && node.textContent.trim()) {
            const key = node.tagName;
            // Skip body/subject/thread as they are handled at root level usually
            if (!['body', 'subject', 'thread'].includes(key)) {
                if (!fields.some(f => f.key === key && f.value === node.textContent)) {
                    fields.push({ key, value: node.textContent, section: section || node.parentElement?.tagName || 'Misc' });
                }
            }
        }

        // Recurse
        Array.from(node.children).forEach(child => {
            // Determine section name: if current node is root, child tag is section. 
            // If current node is already a section, keep it? 
            // Let's try to use the parent tag as the section for leaf nodes.
            traverse(child, node === root ? child.tagName : section);
        });
    };

    // Start traversal from children of root to avoid re-adding root attributes
    Array.from(root.children).forEach(child => traverse(child, child.tagName));

    return fields;
};
