import { Bridge, Ground, HedgesAndWalls, Paths, River } from '../components/game/Terrain';
import { Meadows, Trees } from '../components/game/Vegetation';
import { CastleExterior } from './CastleScene/CastleExterior';
import { ChildrenScene } from './ChildrenScene/ChildrenScene';
import { CoronationScene } from './CoronationScene/CoronationScene';
import { CourtroomScene } from './CourtroomScene/CourtroomScene';
import { FireworksScene } from './FireworksScene/FireworksScene';
import { Gates } from './Gates';
import { GardenScene } from './GardenScene/GardenScene';
import { LibraryScene } from './LibraryScene/LibraryScene';
import { MirrorScene } from './MirrorScene/MirrorScene';
import { StormScene } from './StormScene/StormScene';
import { StrawberryGardenScene } from './StrawberryGardenScene/StrawberryGardenScene';

/** One connected open world: every location lives in the same scene. */
export function Overworld() {
  return (
    <group>
      <Ground />
      <Paths />
      <River />
      <Bridge />
      <HedgesAndWalls />
      <Trees />
      <Meadows />
      <Gates />
      <CoronationScene />
      <CastleExterior />
      <GardenScene />
      <StrawberryGardenScene />
      <MirrorScene />
      <LibraryScene />
      <CourtroomScene />
      <ChildrenScene />
      <StormScene />
      <FireworksScene />
    </group>
  );
}
