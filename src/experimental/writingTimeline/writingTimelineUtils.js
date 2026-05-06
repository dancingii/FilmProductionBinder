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

export function rippleTimelineSceneMove(
  scenes = [],
  movedSceneIndex,
  nextStartPage
) {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;

  const movedScene = scenes[movedSceneIndex];
  if (!movedScene) return scenes;

  const movedSceneId = movedScene.id || movedScene.sceneId || movedScene.scene_id || null;
  const movedSceneKey = movedSceneId ? String(movedSceneId) : null;
  let fallbackCumulativePages = 0;

  const timelineItems = scenes.map((scene, index) => {
    const pageLength = getSceneEstimatedPages(scene);
    const startPage =
      index === movedSceneIndex
        ? Math.max(0, Number(nextStartPage) || 0)
        : getSceneTimelineStartPage(scene, fallbackCumulativePages);
    const sceneId = scene.id || scene.sceneId || scene.scene_id || null;
    const isMovedScene = movedSceneKey
      ? sceneId && String(sceneId) === movedSceneKey
      : index === movedSceneIndex;

    fallbackCumulativePages += pageLength;

    return {
      scene,
      index,
      pageLength,
      startPage,
      isMovedScene,
    };
  });

  const sortedItems = [...timelineItems].sort((a, b) => {
    if (a.startPage !== b.startPage) return a.startPage - b.startPage;
    return a.index - b.index;
  });

  const adjustedStartPages = new Map();
  const movedItemIndex = sortedItems.findIndex((item) => item.isMovedScene);

  if (movedItemIndex === -1) return scenes;

  sortedItems.slice(0, movedItemIndex).forEach((item) => {
    adjustedStartPages.set(item.index, item.startPage);
  });

  let previousEndPage =
    sortedItems[movedItemIndex].startPage + sortedItems[movedItemIndex].pageLength;

  adjustedStartPages.set(
    sortedItems[movedItemIndex].index,
    sortedItems[movedItemIndex].startPage
  );

  sortedItems.slice(movedItemIndex + 1).forEach((item) => {
    const adjustedStartPage =
      item.startPage < previousEndPage ? previousEndPage : item.startPage;
    adjustedStartPages.set(item.index, adjustedStartPage);
    previousEndPage = adjustedStartPage + item.pageLength;
  });

  return scenes.map((scene, index) => {
    const adjustedStartPage = adjustedStartPages.get(index);
    if (!Number.isFinite(adjustedStartPage)) return scene;

    const currentStartPage = Number(scene.timelineStartPage);
    if (Number.isFinite(currentStartPage) && currentStartPage === adjustedStartPage) {
      return scene;
    }

    return {
      ...scene,
      timelineStartPage: adjustedStartPage,
    };
  });
}
