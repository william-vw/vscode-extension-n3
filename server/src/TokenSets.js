import { TokenSet } from './TokenSet.js';

export class TokenSets {

    constructor() {
        this.docTokens = {};
    }

    reset(uri) {
        this.docTokens[uri] = new TokenSet();
    }

    add(uri, type, term) {
        this.docTokens[uri].add(type, term);
    }

    get(type, needle) {
        const ret = new Set();
        Object.values(this.docTokens).forEach(set => 
            set.get(type, needle).forEach(el => ret.add(el)));
            
        return Array.from(ret).sort();
    }
}