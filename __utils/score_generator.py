import json
from graphviz import Digraph

# Read the JSON file structure
with open('../scenarios/node.json', 'r', encoding='utf-8') as f:
    nodes_all = json.load(f)
    nodes = nodes_all[0]

dot = Digraph(comment='Decision Tree', format='pdf')
dot.attr(dpi='600')

def truncate(s, n=30):
    return (s[:n] + '...') if len(s) > n else s

for node_id, node in nodes.items():
    label = f"Question {node.get('question')}"
    if node.get("final"):
        label = f"Answer {node_id[-2:].strip('0')}"
    # more customization (color, image, etc.) here
    dot.node(node_id, label, shape='doubleoctagon' if node.get("final") else 'box')

# Edges:
for node_id, node in nodes.items():
    if not node.get("options"):
        continue
    for opt in node["options"]:
        next_id = opt.get("next")
        opt_label = f"{opt.get('text')}"
        if "action" in opt:
            opt_label += f" {', '.join(opt['action'].split(';'))}"
        if next_id:
            dot.edge(node_id, next_id, label=truncate(opt_label, 40))

# Save and render
output_file = dot.render(filename='tree_diagram', view=False)
print(f"Tree saved as: {output_file}")
