import sys
from rdflib import Graph

g = Graph()
g.parse(data=str(sys.argv[1]), format='n3')
out = g.serialize(format='n3')

print(out)