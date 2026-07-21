export function getNextBoneName(bones: ReadonlyArray<{ name?: string | null }> | null | undefined): string {
  let highestSequence = 0;
  for (const bone of bones ?? []) {
    const match = /^Bone\s+(\d+)$/i.exec(bone?.name?.trim() ?? '');
    if (match) highestSequence = Math.max(highestSequence, Number(match[1]));
  }
  return `Bone ${highestSequence + 1}`;
}
