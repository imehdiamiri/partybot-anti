'use strict';
// Validate external ASTs iteratively before recursive upstream walkers run.
module.exports = ast => {
 const pending = [[ast, 0]];
 let count = 0;
 while (pending.length) {
  const [node, depth] = pending.pop();
  if (depth >= 128 || ++count > 65536) throw new SyntaxError('Brace AST exceeds security depth/node limit');
  if (node && Array.isArray(node.nodes)) {
   if (node.nodes.length + pending.length > 65536 - count) throw new SyntaxError('Brace AST exceeds security node limit');
   for (const child of node.nodes) pending.push([child, depth + 1]);
  }
 }
};
