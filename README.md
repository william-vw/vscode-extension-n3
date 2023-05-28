# Features

Provides N3 syntax checking, code themes, formatting, and N3 code execution.


## Syntax Checking
N3 code syntax is checked as per the latest [N3 grammar](https://w3c.github.io/N3/spec/#grammar).

Missing namespaces are suggested based on a [default file](https://github.com/william-vw/vscode-extension-n3/blob/main/namespaces.json) that is currently quite limited. You can extend this file and point to its path in the extension settings.


## Code Theme

To use a code theme, open an `.n3` file and select the Notation3 Light or Notation3 Dark theme (Command Palette - search "color theme").


## Execution

You can execute your N3 code using [eye](https://github.com/eyereasoner/eye) or [jen3](https://github.com/william-vw/jen3). (Command Palette - `N3: Execute N3 Code`)
- Eye can be found [here](https://github.com/eyereasoner/eye/releases) - follow the installation instructions.
- Jen3 can be found [here](https://github.com/william-vw/jen3/releases) - download the latest release and point to its path in the extension settings.  


## Formatting

You can format N3 code using the regular VSCode shortcut (default: Alt-Shift-F on Windows, Option-Shift-F on Mac, Ctrl-Shift-i on Linux). 

By default, prefix and base declarations are formatted as well: 
meaning they are grouped at the top, written using the '@' syntax, and sorted alphabetically.
This option can be turned off in the extension settings.


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


## Loading multiple files
To execute multiple files, in addition to the current editor file, add the following "directive" at the top of the editor file (i.e., the n3 file you wish to execute):

```
# @alsoload /Users/SomeUser/Documents/file1.n3 file2.n3 subfolder/file3.n3
```
(it is not part of the N3 grammar, so put the comment `#` symbol at the start)

If the file path is not absolute (e.g., `file2.n3`, `subfolder/file3.n3`), then the parent folder of the editor file will be used to resolve the path.

To find out the absolute paths of all executed files, check the `# loaded multiple files` comment at the top of the output.


## Issues

Please post any issues on the [github repo](https://github.com/william-vw/vscode-extension-n3).
