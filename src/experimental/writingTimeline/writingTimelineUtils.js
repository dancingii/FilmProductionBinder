import { calculateBlockLines, LINES_PER_PAGE } from "../../utils.js";

export const DEFAULT_TARGET_PAGES = 90;

export function getSceneEstimatedLines(scene) {
  if (!scene || !Array.isArray(scene.content)) return 1;

  const headingAndSpacingLines = 3;

  return (
    headingAndSpacingLines +
    scene.content.reduce((sum, block) => {
      return sum + calculateBlockLines(block);
    }, 0)
  );
}

export function getSceneEstimatedPages(scene) {
  const lines = getSceneEstimatedLines(scene);
  return Math.max(0.125, lines / LINES_PER_PAGE);
}

export function getTotalWrittenPages(scenes = []) {
  return scenes.reduce((sum, scene) => {
    return sum + getSceneEstimatedPages(scene);
  }, 0);
}

export function formatPageLength(pageLength) {
  if (!Number.isFinite(pageLength)) return "0";

  const eighths = Math.max(1, Math.round(pageLength * 8));
  const wholePages = Math.floor(eighths / 8);
  const remainingEighths = eighths % 8;

  if (wholePages > 0 && remainingEighths > 0) {
    return `${wholePages} ${remainingEighths}/8`;
  }

  if (wholePages > 0) {
    return `${wholePages}`;
  }

  return `${remainingEighths}/8`;
}

export function getSceneTimelineStartPage(scene, fallbackStartPage = 0) {
  const rawStart = scene?.timelineStartPage;

  if (rawStart === null || rawStart === undefined || rawStart === "") {
    return Math.max(0, fallbackStartPage);
  }

  const explicitStart = Number(rawStart);

  if (Number.isFinite(explicitStart)) {
    return Math.max(0, explicitStart);
  }

  return Math.max(0, fallbackStartPage);
}

export function getSceneTimelineData(scenes = [], targetPages = DEFAULT_TARGET_PAGES) {
  let fallbackCumulativePages = 0;

  return scenes.map((scene, index) => {
    const pageLength = getSceneEstimatedPages(scene);
    const startPage = getSceneTimelineStartPage(scene, fallbackCumulativePages);
    const endPage = startPage + pageLength;

    fallbackCumulativePages += pageLength;

    return {
      scene,
      index,
      pageLength,
      startPage,
      endPage,
      widthPercent: Math.max(0.25, (pageLength / targetPages) * 100),
      label: formatPageLength(pageLength),
    };
  });
}
