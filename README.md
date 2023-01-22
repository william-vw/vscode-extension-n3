# Features

Provides N3 syntax checking, code themes, namespace suggestions, and N3 code execution.
The language features are based on the latest [N3 grammar](https://w3c.github.io/N3/spec/#grammar).

## Code Theme

To use a code theme, open an `.n3` file and select the Notation3 Light or Notation3 Dark theme (Command Palette - search "color theme").

## Execution

You can execute your N3 code using [eye](https://github.com/eyereasoner/eye) or [jen3](https://github.com/william-vw/jen3). (Command Palette - `N3: Execute N3 Code`)
- Eye can be found [here](https://github.com/eyereasoner/eye/releases) - follow the installation instructions.
- Jen3 can be found [here](https://github.com/william-vw/jen3/releases) - download the latest release and point to its path in the extension settings.  

Namespaces are suggested based on a [default file](https://github.com/william-vw/vscode-extension-n3/blob/main/namespaces.json) that is currently quite limited. You can extend this file and point to its path in the extension settings.


## Debugging

You can debug your N3 code using [eye](https://github.com/eyereasoner/eye). (Command Palette - `N3: Debug N3 Code`). 
This will print the output of any trace statements added to your rules. For instance:

```
:Socrates a :Greek . :Plato a :Geek . # note the missing "r" for Plato
{ ?A a :Greek . 
  "R1" log:trace ?A
} => { ?A :philosopher true } .
```

Will yield:
```
R1:
:Socrates
```

By default, the extension will group traces per subject (here, `R1`) and remove duplicates. You can disable this behavior in settings (`post process eye traces`).  

You can also insert a trace statement using the right-click context menu (`Add Trace`) or the Command Palette (`N3: Add Trace`). This will insert the following at your cursor:

```
"T[x] log:trace (  ) ."
```

You can then fill in the variables to be traced in the object list.

## Issues

Please post any issues on the [github repo](https://github.com/william-vw/vscode-extension-n3).