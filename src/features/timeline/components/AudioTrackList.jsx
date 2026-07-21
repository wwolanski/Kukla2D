import { AudioTrackRow } from './AudioTrackRow.jsx';

export function AudioTrackList({
  tracks,
  animationId,
  timelineDurationMs,
  updateAudioTrack,
  removeAudioTrack,
  beginAudioTrackGesture,
  endAudioTrackGesture,
  xToFrame,
  startFrame,
  totalFrames,
  fps,
}) {
  return (
    <>
      {tracks.map((audioTrack) => (
        <AudioTrackRow
          key={audioTrack.id}
          track={audioTrack}
          animationId={animationId}
          timelineDurationMs={timelineDurationMs}
          updateAudioTrack={updateAudioTrack}
          removeAudioTrack={removeAudioTrack}
          beginAudioTrackGesture={beginAudioTrackGesture}
          endAudioTrackGesture={endAudioTrackGesture}
          xToFrame={xToFrame}
          startFrame={startFrame}
          totalFrames={totalFrames}
          fps={fps}
        />
      ))}
    </>
  );
}
