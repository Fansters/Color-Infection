import { Container, Graphics } from "pixi.js";

export type PixiLayers = {
  backgroundLayer: Container;
  hazeLayer: Container;
  territoryLayer: Container;
  dotLayer: Container;
  modifierLayer: Container;
  nodeLayer: Container;
  coreLayer: Container;
  effectLayer: Container;
  debugLayer: Container;
  arenaLayer: Container;
  actorLayer: Container;
  arenaMask: Graphics;
};

export function createPixiLayers(stage: Container): PixiLayers {
  const backgroundLayer = new Container({ label: "backgroundLayer" });
  const hazeLayer = new Container({ label: "hazeLayer" });
  const territoryLayer = new Container({ label: "territoryLayer" });
  const dotLayer = new Container({ label: "dotLayer" });
  const modifierLayer = new Container({ label: "modifierLayer" });
  const nodeLayer = new Container({ label: "nodeLayer" });
  const coreLayer = new Container({ label: "coreLayer" });
  const effectLayer = new Container({ label: "effectLayer" });
  const debugLayer = new Container({ label: "debugLayer" });
  const arenaLayer = new Container({ label: "arenaLayer" });
  const actorLayer = new Container({ label: "actorLayer" });
  const arenaMask = new Graphics({ label: "arenaMask" });

  arenaLayer.addChild(
    hazeLayer,
    territoryLayer,
    dotLayer,
    modifierLayer,
    nodeLayer,
  );
  actorLayer.addChild(
    coreLayer,
    effectLayer,
    debugLayer,
  );
  arenaLayer.mask = arenaMask;
  actorLayer.mask = arenaMask;
  stage.addChild(backgroundLayer, arenaLayer, actorLayer, arenaMask);

  return {
    backgroundLayer,
    hazeLayer,
    territoryLayer,
    dotLayer,
    modifierLayer,
    nodeLayer,
    coreLayer,
    effectLayer,
    debugLayer,
    arenaLayer,
    actorLayer,
    arenaMask,
  };
}

export function countPixiChildren(layers: PixiLayers) {
  return (
    layers.backgroundLayer.children.length +
    layers.hazeLayer.children.length +
    layers.territoryLayer.children.length +
    layers.dotLayer.children.length +
    layers.modifierLayer.children.length +
    layers.nodeLayer.children.length +
    layers.coreLayer.children.length +
    layers.effectLayer.children.length +
    layers.debugLayer.children.length
  );
}
