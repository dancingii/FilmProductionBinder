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
  const writingPageLength = Number(scene?.metadata?.writingTimelinePageLength);

  if (Number.isFinite(writingPageLength) && writingPageLength > 0) {
    return Math.max(0.125, writingPageLength);
  }

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
    const hasExplicitStartPage =
      scene?.timelineStartPage !== null &&
      scene?.timelineStartPage !== undefined &&
      scene?.timelineStartPage !== "";
    const startPage = hasExplicitStartPage
      ? getSceneTimelineStartPage(scene, fallbackCumulativePages)
      : fallbackCumulativePages;
    const endPage = startPage + pageLength;

    fallbackCumulativePages = endPage;

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

function getSourceCloseIndexes(timelineItems = [], movedSceneIndex) {
  const sortedItems = [...timelineItems].sort((a, b) => {
    if (a.startPage !== b.startPage) return a.startPage - b.startPage;
    return a.index - b.index;
  });
  const movedSortedIndex = sortedItems.findIndex(
    (item) => item.index === movedSceneIndex
  );
  const movedItem = sortedItems[movedSortedIndex];
  const sourceCloseIndexes = new Set();
  const EPSILON = 0.001;

  if (!movedItem) return sourceCloseIndexes;

  let clusterEndPage = movedItem.endPage;

  for (const item of sortedItems.slice(movedSortedIndex + 1)) {
    if (item.startPage > clusterEndPage + EPSILON) break;

    sourceCloseIndexes.add(item.index);
    clusterEndPage = Math.max(clusterEndPage, item.endPage);
  }

  return sourceCloseIndexes;
}

export function getSourceClosedTimelineScenes(scenes = [], movedSceneIndex) {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;

  const movedScene = scenes[movedSceneIndex];
  if (!movedScene) return scenes;

  let fallbackCumulativePages = 0;

  const timelineItems = scenes.map((scene, index) => {
    const pageLength = getSceneEstimatedPages(scene);
    const hasExplicitStartPage =
      scene?.timelineStartPage !== null &&
      scene?.timelineStartPage !== undefined &&
      scene?.timelineStartPage !== "";
    const startPage = hasExplicitStartPage
      ? getSceneTimelineStartPage(scene, fallbackCumulativePages)
      : fallbackCumulativePages;
    const endPage = startPage + pageLength;

    fallbackCumulativePages = endPage;

    return {
      index,
      pageLength,
      startPage,
      endPage,
    };
  });

  const movedItem = timelineItems[movedSceneIndex];
  if (!movedItem) return scenes;

  const sourceLength = movedItem.pageLength;
  const sourceCloseIndexes = getSourceCloseIndexes(timelineItems, movedSceneIndex);

  return scenes.map((scene, index) => {
    if (index === movedSceneIndex) return scene;

    const item = timelineItems[index];
    if (!item || !sourceCloseIndexes.has(index)) return scene;

    const adjustedStartPage = Math.max(0, item.startPage - sourceLength);
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

export function rippleTimelineSceneMove(
  scenes = [],
  movedSceneIndex,
  nextStartPage
) {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;

  const movedScene = scenes[movedSceneIndex];
  if (!movedScene) return scenes;

  let fallbackCumulativePages = 0;

  const timelineItems = scenes.map((scene, index) => {
    const pageLength = getSceneEstimatedPages(scene);
    const hasExplicitStartPage =
      scene?.timelineStartPage !== null &&
      scene?.timelineStartPage !== undefined &&
      scene?.timelineStartPage !== "";
    const startPage = hasExplicitStartPage
      ? getSceneTimelineStartPage(scene, fallbackCumulativePages)
      : fallbackCumulativePages;
    const endPage = startPage + pageLength;
    const isMovedScene = index === movedSceneIndex;

    fallbackCumulativePages = endPage;

    return {
      scene,
      index,
      pageLength,
      startPage,
      endPage,
      isMovedScene,
    };
  });

  const movedItem = timelineItems.find((item) => item.isMovedScene);
  if (!movedItem) return scenes;

  const movedStartPage = Math.max(0, Number(nextStartPage) || 0);
  const sourceLength = movedItem.pageLength;
  const sourceCloseIndexes = getSourceCloseIndexes(timelineItems, movedSceneIndex);

  const sourceClosedItems = timelineItems
    .filter((item) => !item.isMovedScene)
    .map((item) => {
      const shouldCloseSourceGap = sourceCloseIndexes.has(item.index);
      return {
        ...item,
        desiredStartPage: Math.max(
          0,
          shouldCloseSourceGap ? item.startPage - sourceLength : item.startPage
        ),
      };
    })
    .sort((a, b) => {
      if (a.desiredStartPage !== b.desiredStartPage) {
        return a.desiredStartPage - b.desiredStartPage;
      }
      return a.index - b.index;
    });

  const finalItems = [
    ...sourceClosedItems,
    {
      ...movedItem,
      desiredStartPage: movedStartPage,
    },
  ].sort((a, b) => {
    if (a.desiredStartPage !== b.desiredStartPage) {
      return a.desiredStartPage - b.desiredStartPage;
    }
    if (a.isMovedScene !== b.isMovedScene) return a.isMovedScene ? -1 : 1;
    return a.index - b.index;
  });

  const adjustedStartPages = new Map();
  const movedItemIndex = finalItems.findIndex((item) => item.isMovedScene);

  if (movedItemIndex === -1) return scenes;

  finalItems.slice(0, movedItemIndex).forEach((item) => {
    adjustedStartPages.set(item.index, item.desiredStartPage);
  });

  const previousItem = finalItems[movedItemIndex - 1];
  let previousEndPage = previousItem
    ? previousItem.desiredStartPage + previousItem.pageLength
    : 0;

  finalItems.slice(movedItemIndex).forEach((item) => {
    const adjustedStartPage = Math.max(item.desiredStartPage, previousEndPage);
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
