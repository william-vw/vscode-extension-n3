/* eslint-disable no-case-declarations */
// import { Trie, TrieNode } from '@datastructures-js/trie';

export class TokenSet {

    constructor() {
        this.types = {
            'iri': [],
            'pname': {},
            'bnode': [],
            'qvar': []
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

        tokens.push(term);
    }

    // get(type, str) {
    //     let trie = this.types[type];
    //     if (trie.has(str))
    //         return trie.find(str).toArray();
        
    //     return [];
    // }

    get(type) {
        return this.types[type];
    }

    getLNames(prefix) {
        let lnames = this.types['pname'][prefix];
        if (!lnames) {
            lnames = [];
            this.types['pname'][prefix] = lnames;
        }

        return lnames;
    }
}