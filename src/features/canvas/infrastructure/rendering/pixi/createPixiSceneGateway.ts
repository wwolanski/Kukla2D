import { PixiSceneGateway, type PixiSceneGatewayOptions } from './PixiSceneGateway.js';

export function createPixiSceneGateway(options: PixiSceneGatewayOptions): PixiSceneGateway {
  return new PixiSceneGateway(options);
}
