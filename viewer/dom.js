import morphdom from "morphdom";

// Compare the generated source, not just the live DOM: localization and zoom
// legitimately alter mounted nodes. Reapplying unchanged source would undo
// those changes and make their observers translate/resize the same content again.
export function createRenderer(regions, beforeUpdate) {
  const source = new WeakMap();
  const remember = (node) => {
    if (node.nodeType === 1 && node.matches(regions))
      source.set(node, node.outerHTML);
  };
  const invalidate = (node) => {
    for (let current = node; current; current = current.parentElement) {
      source.delete(current);
    }
  };
  const patch = (node, html, childrenOnly = false) => {
    invalidate(node.parentElement);
    morphdom(node, html, {
      childrenOnly,
      onNodeAdded: remember,
      onBeforeElUpdated(from, to) {
        if (from.matches(regions)) {
          const next = to.outerHTML;
          if (source.get(from) === next) return false;
          source.set(from, next);
        }
        beforeUpdate?.(from, to);
        return !from.isEqualNode(to);
      },
    });
  };
  patch.invalidate = invalidate;
  return patch;
}
