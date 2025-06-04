// state/progress.js
export let progressState = { current: 0, total: 0, title: "" };

export function updateProgress(curr, total, title) {
  progressState = { current: curr, total: total, title: title };
}

export function resetProgress() {
  progressState = { current: 0, total: 0, title: "" };
}
