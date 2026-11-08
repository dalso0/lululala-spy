// 손맛 효과 한곳에서: 소리(play) · 진동(haptic) · 파티클(burst)
export { isAudioReady, isSoundOn, play, setSoundOn, subscribeSound, unlockAudio, type SoundName } from "./sound";
export { haptic, type HapticKind } from "./haptics";
export { burst, burstAt, type BurstKind } from "./particles";

import { haptic, type HapticKind } from "./haptics";
import { play, type SoundName } from "./sound";

/** 소리 + 진동을 한 번에 */
export function feel(sound: SoundName, vibe?: HapticKind) {
  play(sound);
  if (vibe) haptic(vibe);
}
