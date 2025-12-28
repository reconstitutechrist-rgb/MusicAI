/**
 * Stem Blender Component
 * Main container for the multi-source stem blending feature
 */

import React from "react";
import Page from "../../ui/Page";
import Card from "../../ui/Card";
import { StemBlenderProvider } from "./StemBlenderProvider";
import StemLibrary from "./StemLibrary";
import BlenderMixer from "./BlenderMixer";
import { SeparatedSong } from "../../../types/stemBlender";

interface StemBlenderProps {
  audioContext?: AudioContext;
  initialSong?: SeparatedSong;
  onInitialSongConsumed?: () => void;
}

const StemBlenderContent: React.FC = () => {
  return (
    <Page
      title="Stem Blender"
      description="Mix stems from different songs to create unique blends. Combine drums from one track with vocals from another."
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Left Panel - Stem Library */}
        <Card className="lg:col-span-1 overflow-auto">
          <StemLibrary />
        </Card>

        {/* Right Panel - Mixer */}
        <Card className="lg:col-span-3 overflow-hidden flex flex-col p-0">
          <BlenderMixer />
        </Card>
      </div>

      {/* Tips */}
      <Card className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Tips for Best Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex gap-2">
            <span className="text-xl">🎵</span>
            <div>
              <p className="font-medium">Similar BPM</p>
              <p className="text-gray-400">
                Mix stems from songs with similar tempos for tighter blends
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-xl">🎹</span>
            <div>
              <p className="font-medium">Compatible Keys</p>
              <p className="text-gray-400">
                Songs in the same or relative keys blend more harmoniously
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-xl">🎚️</span>
            <div>
              <p className="font-medium">Balance Levels</p>
              <p className="text-gray-400">
                Adjust volumes to ensure no single stem overpowers the mix
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-xl">⏱️</span>
            <div>
              <p className="font-medium">Use Offsets</p>
              <p className="text-gray-400">
                Align track starts using the offset control for perfect sync
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Page>
  );
};

const StemBlender: React.FC<StemBlenderProps> = ({
  audioContext,
  initialSong,
  onInitialSongConsumed,
}) => {
  return (
    <StemBlenderProvider
      audioContext={audioContext}
      initialSong={initialSong}
      onInitialSongConsumed={onInitialSongConsumed}
    >
      <StemBlenderContent />
    </StemBlenderProvider>
  );
};

export default StemBlender;
