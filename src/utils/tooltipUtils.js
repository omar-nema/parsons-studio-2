import {
  tooltipText,
  tooltipX,
  tooltipY,
  tooltipShow,
} from '../stores/pageState';
export function updateTooltip(xInput, yInput, text) {
  if (!text && !xInput && !yInput) {
    tooltipShow.set(false);
  } else {
    tooltipShow.set(true);
    tooltipX.set(xInput);
    tooltipY.set(yInput);
    if (text) {
      tooltipText.set(text);
    }
  }
}

export function updateHelperTextPos(
  index,
  clientRect,
  cardRect,
  helperTextPositions
) {
  let x, y;

  x = Math.min(
    clientRect.x + clientRect.width / 4 - cardRect.x,
    cardRect.width - 450
  );

  if (index == 0) {
    y = clientRect.y - cardRect.y;

    // left: 50%;
    // transform: translate(-50%);
    // top: calc(100% - 220px);
  } else {
    y = clientRect.y + 50;
  }
  helperTextPositions[index] = [x, y];
}

//hint-holder
