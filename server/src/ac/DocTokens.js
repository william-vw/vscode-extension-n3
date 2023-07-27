import { TokenSet } from './TokenSet.js';

export class DocTokens {

    constructor() {
        this.clear();
    }

    reset(uri) {
        this.docTokens[uri] = new TokenSet();
    }

    add(uri, type, term) {
        this.docTokens[uri].add(type, term);
    }

    get(uri, type, needle) {
        return Array.from(this.docTokens[uri].get(type, needle)).sort();
    }

    getAll(type, needle) {
        const ret = new Set();
        Object.values(this.docTokens).forEach(set => 
            set.get(type, needle).forEach(el => ret.add(el)));
            
        return Array.from(ret).sort();
    }

    clear() {
        this.docTokens = {};
    }
}