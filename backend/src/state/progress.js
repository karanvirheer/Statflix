// state/progress.js
export let progressState = { current: 0, total: 0 };

export function updateProgress(curr, total) {
  progressState = { current: curr, total: total };
}

export function resetProgress() {
  progressState = { current: 0, total: 0 };
}
