import { describe, it, expect, beforeEach } from 'vitest';
import { MarqueeController, MarqueeContainmentMode } from './interaction/marquee-controller';
import { InteractionContext } from './interaction/interaction-context';
import { StateNode } from './state/state-node';
import { Viewport } from './camera/viewport';
import { Camera } from './camera/camera';
import { RenderQueue } from './pipeline/render-queue';
import { StateRenderer } from './state/state-renderer';
import { EdgeRenderer } from './edge/edge-renderer';
import { TransitionEdge } from './edge/edge-transition';

describe('MarqueeController Subsystem & Semantics', () => {
  let marqueeController: MarqueeController;
  let context: InteractionContext;
  let viewport: Viewport;
  let camera: Camera;

  const nodes: StateNode[] = [
    { id: 'q0', label: 'q0', x: 0, y: 0, radius: 32 },
    { id: 'q1', label: 'q1', x: 200, y: 0, radius: 32 },
    { id: 'q2', label: 'q2', x: 0, y: 200, radius: 32 },
  ];

  beforeEach(() => {
    marqueeController = new MarqueeController();
    context = new InteractionContext();
    viewport = new Viewport(800, 600, 1.0);
    camera = new Camera(viewport);
  });

  it('handles negative-width and negative-height drag rectangles accurately', () => {
    // Start drag at (250, 50) and drag backwards to (-50, -50)
    marqueeController.startMarquee(context, { x: 250, y: 50 });
    marqueeController.updateMarquee(context, { x: -50, y: -50 }, nodes);

    expect(context.isNodeSelected('q0')).toBe(true);
    expect(context.isNodeSelected('q1')).toBe(true);
    expect(context.isNodeSelected('q2')).toBe(false);

    expect(context.marqueeRect?.minX).toBe(-50);
    expect(context.marqueeRect?.maxX).toBe(250);
    expect(context.marqueeRect?.minY).toBe(-50);
    expect(context.marqueeRect?.maxY).toBe(50);
  });

  it('supports center-point containment mode when configured', () => {
    const centerModeController = new MarqueeController({
      containmentMode: MarqueeContainmentMode.CenterPointContainment,
    });

    // Box from (-10, -10) to (10, 10) contains center of q0 (0,0)
    centerModeController.startMarquee(context, { x: -10, y: -10 });
    centerModeController.updateMarquee(context, { x: 10, y: 10 }, nodes);

    expect(context.isNodeSelected('q0')).toBe(true);
    expect(context.isNodeSelected('q1')).toBe(false);
  });

  it('supports additive marquee selection with existing selections', () => {
    context.selectNode('q2');

    marqueeController.startMarquee(context, { x: -50, y: -50 }, true);
    marqueeController.updateMarquee(context, { x: 50, y: 50 }, nodes, true);

    expect(context.isNodeSelected('q2')).toBe(true);
    expect(context.isNodeSelected('q0')).toBe(true);
  });

  it('handles empty / zero-size marquee without throwing', () => {
    marqueeController.startMarquee(context, { x: 0, y: 0 });
    marqueeController.updateMarquee(context, { x: 0, y: 0 }, []);
    expect(context.marqueeRect?.width).toBe(0);
    expect(context.marqueeRect?.height).toBe(0);
  });

  it('enqueues draw command for marquee rendering on selection layer', () => {
    marqueeController.startMarquee(context, { x: 0, y: 0 });
    marqueeController.updateMarquee(context, { x: 100, y: 100 }, nodes);
    const queue = new RenderQueue();

    marqueeController.enqueueDrawCommands(queue, context, camera);
    expect(queue.getCount()).toBe(1);
  });

  it('selects edges intersected by marquee rectangle', () => {
    const stateRenderer = new StateRenderer();
    const edgeRenderer = new EdgeRenderer();
    stateRenderer.setStateNodes(nodes);

    const edge1: TransitionEdge = { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' };
    const edge2: TransitionEdge = { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q2', label: 'b' };
    edgeRenderer.setEdges([edge1, edge2]);

    // Marquee from (50, -20) to (150, 20) covers midpoint of edge1 (100, 0), but misses edge2 (0, 100)
    marqueeController.startMarquee(context, { x: 50, y: -20 });
    marqueeController.updateMarquee(
      context,
      { x: 150, y: 20 },
      nodes,
      false,
      [edge1, edge2],
      stateRenderer,
      edgeRenderer
    );

    expect(context.isEdgeSelected('e1')).toBe(true);
    expect(context.isEdgeSelected('e2')).toBe(false);
  });

  it('supports additive edge selection in marquee', () => {
    const stateRenderer = new StateRenderer();
    const edgeRenderer = new EdgeRenderer();
    stateRenderer.setStateNodes(nodes);

    const edge1: TransitionEdge = { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' };
    const edge2: TransitionEdge = { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q2', label: 'b' };
    edgeRenderer.setEdges([edge1, edge2]);

    context.selectEdge('e2');

    marqueeController.startMarquee(context, { x: 50, y: -20 }, true);
    marqueeController.updateMarquee(
      context,
      { x: 150, y: 20 },
      nodes,
      true,
      [edge1, edge2],
      stateRenderer,
      edgeRenderer
    );

    expect(context.isEdgeSelected('e1')).toBe(true);
    expect(context.isEdgeSelected('e2')).toBe(true);
  });
});
