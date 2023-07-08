/* eslint-disable no-case-declarations */
// import { Trie, TrieNode } from '@datastructures-js/trie';

export class TokenSet {

    constructor() {
        this.types = {
            'iri': new Set(),
            'pname': {},
            'bnode': new Set(),
            'qvar': new Set()
        };
    }

    add(type, term) {
        let tokens = null;
        switch (type) {

            case 'pname':
                let [ prefix, lname ] = term;
                term = lname;
                tokens = this.getLNames(prefix);

                break;

            default:
                tokens = this.types[type];
                break;
        }

        tokens.add(term);
    }

    // get(type, str) {
    //     let trie = this.types[type];
    //     if (trie.has(str))
    //         return trie.find(str).toArray();
        
    //     return [];
    // }

    get(type, needle) {
        let ret = null;
        switch (type) {

        case 'pname':
            ret = this.getLNames(needle);
            break;
        
        default:
            ret = this.types[type];
            break;
        }

        // return Array.from(ret);
        return ret;
    }

    getLNames(prefix) {
        let lnames = this.types['pname'][prefix];
        if (!lnames) {
            lnames = new Set();
            this.types['pname'][prefix] = lnames;
        }

        return lnames;
    }
}