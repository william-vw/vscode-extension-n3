# NOTES

## ANTLR parser
Follow the [readme](https://github.com/w3c/N3/blob/master/grammar/README.md#javascript) on the N3 grammar to re-compile and package the JavaScript ANTLR parser.

For packaging, we currently rely on the [`webpack.config.js`](https://github.com/william-vw/n3-editor-js/blob/master/editor/webpack.config.js) of the n3-editor-js project (second configuration, commented out). We simply run webpack in that project and copy the `n3Main_umd.js` file to `server/src`, renaming it to `n3Main.js`.  

*NB*: the second configuration in that [config file](https://github.com/william-vw/n3-editor-js/blob/master/editor/webpack.config.js) generates a dist that can be included using `requires`. The first configuration is for use in a web page. ** For some reason, using minimization results in errors **  
*NB*: if not working according to expectations, try clearing the `server/out` folder first.

## tsconfig.json
Previously needed `"compile": true` in `client/tsconfig.json` and `server/tsconfig.json`.
After trying on a different computer, it resulted in these two projects not compiling somehow.