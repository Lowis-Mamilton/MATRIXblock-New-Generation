# ADR 0002: Horizontal renderer for Icon blocks

**Status**: Accepted (2026-10-09, validated by a spike)

## Context
Every built-in Blockly renderer stacks statement blocks top to bottom. Icon blocks must chain left to right.

## Decision
- `IconRenderer` overrides `Renderer.render()` and does the whole layout itself: it measures fields, draws the outline, and places the previous / next / statement connections on the left and right edges. Blockly's own connection logic then chains blocks sideways from those offsets.
- All blocks share one **connection line** (the y of their left / right connections). Plain blocks hang below it; loops are arches (head, top arm, end cap) whose inner chain starts at the head's right edge, rising above the line by `ARM` plus the inner chain's ascent.
- A block mixin overrides `getHeightWidth()` to report the horizontal chain's size, used for workspace bounds and flyout layout.
- A custom `IconConnectionPreviewer` replaces Blockly's insertion marker, which pushes following blocks *down*. While dragging, a glowing vertical bar marks where the block will snap.

## Consequences
- Depends on Blockly internals: `Renderer.render`, `BlockSvg.width/height/childlessWidth`, `RenderedConnection.setOffsetInBlock`, `pathObject.addConnectionHighlight`. Re-test Icon mode after every major Blockly upgrade.
- Icon blocks use fields only; they cannot have value inputs.
