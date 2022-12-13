import sys
from rdflib import Graph

g = Graph()
g.parse(data=str(sys.argv[2]), format='n3')
g.serialize(format='n3')

