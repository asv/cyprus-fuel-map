export type SheetState = "collapsed" | "expanded";

type BottomSheetController = {
  element: HTMLElement;
  setState(nextState: SheetState): void;
  panAboveSheet(): void;
};

const SHEET_DRAG_THRESHOLD_PX = 24;

export function createBottomSheetController(options: {
  bottomSheetEl: HTMLElement;
  sheetDragRegionEl: HTMLElement;
  sheetHandleButton: HTMLButtonElement;
  invalidateMap: () => void;
  updateMarkerPriceLabels: () => void;
  panMapBy: (point: [number, number]) => void;
}): BottomSheetController {
  let sheetState: SheetState = "collapsed";
  let sheetDragStartY: number | null = null;
  let didDragSheet = false;

  options.sheetHandleButton.addEventListener("click", () => {
    if (didDragSheet) {
      didDragSheet = false;
      return;
    }
    setState(sheetState === "expanded" ? "collapsed" : "expanded");
  });

  options.sheetDragRegionEl.addEventListener(
    "click",
    (event) => {
      if (!didDragSheet) return;

      didDragSheet = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  options.sheetDragRegionEl.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;

    sheetDragStartY = event.clientY;
    didDragSheet = false;
    options.sheetDragRegionEl.setPointerCapture(event.pointerId);
  });

  options.sheetDragRegionEl.addEventListener("pointerup", (event) => {
    if (sheetDragStartY === null) return;

    const deltaY = event.clientY - sheetDragStartY;
    sheetDragStartY = null;
    if (options.sheetDragRegionEl.hasPointerCapture(event.pointerId)) {
      options.sheetDragRegionEl.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaY) < SHEET_DRAG_THRESHOLD_PX) return;

    didDragSheet = true;
    setState(deltaY < 0 ? "expanded" : "collapsed");
  });

  options.sheetDragRegionEl.addEventListener("pointercancel", (event) => {
    sheetDragStartY = null;
    didDragSheet = false;
    if (options.sheetDragRegionEl.hasPointerCapture(event.pointerId)) {
      options.sheetDragRegionEl.releasePointerCapture(event.pointerId);
    }
  });

  function setState(nextState: SheetState): void {
    sheetState = nextState;
    const isExpanded = sheetState === "expanded";

    options.bottomSheetEl.classList.toggle("is-expanded", isExpanded);
    options.bottomSheetEl.classList.toggle("is-collapsed", !isExpanded);
    options.sheetHandleButton.setAttribute("aria-expanded", String(isExpanded));
    options.sheetHandleButton.setAttribute("aria-label", isExpanded ? "Hide station list" : "Show station list");
    options.sheetHandleButton.title = isExpanded ? "Hide station list" : "Show station list";

    requestAnimationFrame(() => {
      options.invalidateMap();
      options.updateMarkerPriceLabels();
    });
  }

  function panAboveSheet(): void {
    options.panMapBy([0, Math.round(options.bottomSheetEl.getBoundingClientRect().height / 5)]);
  }

  return { element: options.bottomSheetEl, setState, panAboveSheet };
}
