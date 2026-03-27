/**
 * Плагин avia: аннотации к фреймам. Настройка стороны — figma.clientStorage.
 * Структура: Group «Annotation» → Frame «Annotation layout» (auto layout) → «Annotation link» + «Annotation».
 * Линия — перпендикуляр граням, от аннотации до контура фрейма.
 */

const STORAGE_KEY = "annotationSide";
const GAP = 40;
const LAYOUT_FRAME_MIN_HEIGHT = 73;

type AnnotationSide = "below" | "above" | "left" | "right";

function focusEditorWindow(): void {
  const api = figma as PluginAPI & { activeWindow?: { focus?: () => void } };
  api.activeWindow?.focus?.();
}

async function getAnnotationSide(): Promise<AnnotationSide> {
  const v = await figma.clientStorage.getAsync(STORAGE_KEY);
  if (v === "below" || v === "above" || v === "left" || v === "right") {
    return v;
  }
  return "below";
}

/** Фрейм с auto layout: стрелка (вектор) + аннотация. */
function configureLayoutFrame(layoutFrame: FrameNode, side: AnnotationSide, noteWidth: number): void {
  layoutFrame.name = "Annotation layout";
  layoutFrame.fills = [];
  layoutFrame.clipsContent = false;
  layoutFrame.itemSpacing = 0;
  layoutFrame.paddingLeft = 0;
  layoutFrame.paddingRight = 0;
  layoutFrame.paddingTop = 0;
  layoutFrame.paddingBottom = 0;

  if (side === "below" || side === "above") {
    layoutFrame.layoutMode = "VERTICAL";
    layoutFrame.primaryAxisAlignItems = "MIN";
    layoutFrame.counterAxisAlignItems = "MIN";
    layoutFrame.layoutSizingHorizontal = "FIXED";
    /** Hug contents по высоте: основная ось — вертикаль. */
    layoutFrame.layoutSizingVertical = "HUG";
    layoutFrame.primaryAxisSizingMode = "AUTO";
    layoutFrame.resize(noteWidth, 1);
  } else {
    layoutFrame.layoutMode = "HORIZONTAL";
    layoutFrame.primaryAxisAlignItems = "MIN";
    layoutFrame.counterAxisAlignItems = "MIN";
    layoutFrame.layoutSizingHorizontal = "HUG";
    /** Hug contents по высоте: поперечная ось — вертикаль. */
    layoutFrame.layoutSizingVertical = "HUG";
    layoutFrame.counterAxisSizingMode = "AUTO";
  }

  layoutFrame.minHeight = LAYOUT_FRAME_MIN_HEIGHT;
}

/**
 * Полоса под стрелку (ниже/выше): фиксированная высота GAP в родителе,
 * внутри — вектор с FILL по высоте без конфликта с Hug у Annotation layout.
 */
function configureLinkRow(linkRow: FrameNode, noteW: number): void {
  linkRow.name = "Annotation link";
  linkRow.fills = [];
  linkRow.clipsContent = false;
  linkRow.layoutMode = "VERTICAL";
  linkRow.primaryAxisAlignItems = "MIN";
  linkRow.counterAxisAlignItems = "MIN";
  linkRow.itemSpacing = 0;
  linkRow.paddingLeft = 0;
  linkRow.paddingRight = 0;
  linkRow.paddingTop = 0;
  linkRow.paddingBottom = 0;
  linkRow.resize(noteW, GAP);
}

/** После append дочерних узлов во фрейм с auto layout. */
function applyLayoutFrameChildrenSizing(
  link: VectorNode,
  note: FrameNode,
  side: AnnotationSide,
  linkRow: FrameNode | null
): void {
  if (side === "below" || side === "above") {
    const row = linkRow!;
    row.layoutSizingHorizontal = "FILL";
    row.layoutSizingVertical = "FIXED";
    row.resizeWithoutConstraints(note.width, GAP);
    link.layoutSizingHorizontal = "FILL";
    link.layoutSizingVertical = "FILL";
    link.minHeight = GAP;
    note.layoutSizingHorizontal = "FILL";
    note.layoutSizingVertical = "HUG";
  } else {
    link.layoutSizingHorizontal = "FIXED";
    /** Fill container по высоте (поперечная ось ряда). */
    link.layoutSizingVertical = "FILL";
    link.layoutAlign = "STRETCH";
    note.layoutSizingHorizontal = "FIXED";
    note.layoutSizingVertical = "FILL";
    link.minHeight = GAP;
  }
}

/**
 * Начало — центр ближайшей к фрейму границы аннотации.
 * Направление — перпендикуляр к этой грани (и к парной грани фрейма): ось X или Y, без диагонали.
 */
function getAnnotationLinkStart(
  frame: FrameNode,
  layoutFrame: FrameNode,
  note: FrameNode,
  side: AnnotationSide
): { startX: number; startY: number } {
  const nx = layoutFrame.x + note.x;
  const ny = layoutFrame.y + note.y;
  const nw = note.width;
  const nh = note.height;

  switch (side) {
    case "below":
      return { startX: nx + nw / 2, startY: ny };
    case "above":
      return { startX: nx + nw / 2, startY: ny + nh };
    case "right":
      return { startX: nx, startY: ny + nh / 2 };
    case "left":
      return { startX: nx + nw, startY: ny + nh / 2 };
  }
}

/** Единичное направление «в сторону фрейма» вдоль перпендикуляра к граням (ниже/выше — по Y, слева/справа — по X). */
function getPerpendicularTowardFrameDir(side: AnnotationSide): { dirX: number; dirY: number } {
  switch (side) {
    case "below":
      return { dirX: 0, dirY: -1 };
    case "above":
      return { dirX: 0, dirY: 1 };
    case "right":
      return { dirX: -1, dirY: 0 };
    case "left":
      return { dirX: 1, dirY: 0 };
  }
}

/** Первая точка пересечения луча с контуром прямоугольника (вдоль луча t > 0). */
function intersectRayWithRectBoundary(
  sx: number,
  sy: number,
  dirX: number,
  dirY: number,
  fx: number,
  fy: number,
  fw: number,
  fh: number
): { x: number; y: number } | null {
  const eps = 1e-6;
  if (Math.hypot(dirX, dirY) < eps) {
    return null;
  }

  let bestT = Infinity;
  let best: { x: number; y: number } | null = null;

  function consider(t: number, x: number, y: number): void {
    if (t <= eps || t >= bestT) {
      return;
    }
    if (x < fx - eps || x > fx + fw + eps || y < fy - eps || y > fy + fh + eps) {
      return;
    }
    bestT = t;
    best = { x, y };
  }

  if (Math.abs(dirY) > eps) {
    const t = (fy + fh - sy) / dirY;
    const x = sx + t * dirX;
    if (x >= fx - eps && x <= fx + fw + eps) {
      consider(t, x, fy + fh);
    }
  }
  if (Math.abs(dirY) > eps) {
    const t = (fy - sy) / dirY;
    const x = sx + t * dirX;
    if (x >= fx - eps && x <= fx + fw + eps) {
      consider(t, x, fy);
    }
  }
  if (Math.abs(dirX) > eps) {
    const t = (fx + fw - sx) / dirX;
    const y = sy + t * dirY;
    if (y >= fy - eps && y <= fy + fh + eps) {
      consider(t, fx + fw, y);
    }
  }
  if (Math.abs(dirX) > eps) {
    const t = (fx - sx) / dirX;
    const y = sy + t * dirY;
    if (y >= fy - eps && y <= fy + fh + eps) {
      consider(t, fx, y);
    }
  }

  return best;
}

function getAnnotationLinkEndpoints(
  frame: FrameNode,
  layoutFrame: FrameNode,
  note: FrameNode,
  side: AnnotationSide
): { startX: number; startY: number; endX: number; endY: number } {
  const { x: fx, y: fy, width: fw, height: fh } = frame;
  const { startX, startY } = getAnnotationLinkStart(frame, layoutFrame, note, side);
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  const { dirX, dirY } = getPerpendicularTowardFrameDir(side);

  const hit = intersectRayWithRectBoundary(startX, startY, dirX, dirY, fx, fy, fw, fh);
  if (hit) {
    return { startX, startY, endX: hit.x, endY: hit.y };
  }

  switch (side) {
    case "below":
      return { startX, startY, endX: cx, endY: fy + fh };
    case "above":
      return { startX, startY, endX: cx, endY: fy };
    case "right":
      return { startX, startY, endX: fx + fw, endY: cy };
    case "left":
      return { startX, startY, endX: fx, endY: cy };
  }
}

async function setAnnotationLinkGeometry(
  link: VectorNode,
  layoutFrame: FrameNode,
  frame: FrameNode,
  note: FrameNode,
  side: AnnotationSide,
  linkRow: FrameNode | null
): Promise<void> {
  const { startX, startY, endX, endY } = getAnnotationLinkEndpoints(frame, layoutFrame, note, side);
  const dx = endX - startX;
  const dy = endY - startY;

  if (Math.hypot(dx, dy) < 0.01) {
    return;
  }

  const linkAbsX = layoutFrame.x + (linkRow ? linkRow.x + link.x : link.x);
  const linkAbsY = layoutFrame.y + (linkRow ? linkRow.y + link.y : link.y);
  const v0x = startX - linkAbsX;
  const v0y = startY - linkAbsY;
  const v1x = endX - linkAbsX;
  const v1y = endY - linkAbsY;

  await link.setVectorNetworkAsync({
    vertices: [
      { x: v0x, y: v0y, strokeCap: "NONE" },
      { x: v1x, y: v1y, strokeCap: "ARROW_EQUILATERAL" },
    ],
    segments: [{ start: 0, end: 1 }],
    regions: [],
  });
}

/**
 * Зазор GAP между фреймом и аннотацией — внутри фрейма «Annotation layout».
 * Край фрейма совпадает с краем выбранного фрейма по общей стороне.
 */
function positionLayoutFrameRelativeToFrame(frame: FrameNode, layoutFrame: FrameNode, side: AnnotationSide): void {
  const { x: fx, y: fy, width: fw, height: fh } = frame;
  const ww = layoutFrame.width;
  const wh = layoutFrame.height;

  switch (side) {
    case "below":
      layoutFrame.x = fx;
      layoutFrame.y = fy + fh;
      break;
    case "above":
      layoutFrame.x = fx;
      layoutFrame.y = fy - wh;
      break;
    case "right":
      layoutFrame.x = fx + fw;
      layoutFrame.y = fy;
      break;
    case "left":
      layoutFrame.x = fx - ww;
      layoutFrame.y = fy;
      break;
  }
}

async function createNote(): Promise<void> {
  const side = await getAnnotationSide();

  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    figma.notify("Выберите один фрейм.");
    return;
  }

  const selected = selection[0];
  if (selected.type !== "FRAME") {
    figma.notify("Выберите фрейм (Frame).");
    return;
  }

  const frame = selected as FrameNode;
  const parent = frame.parent;
  if (!parent || !("appendChild" in parent)) {
    figma.notify("Не удалось вставить аннотацию в родителя фрейма.");
    return;
  }

  const { width } = frame;

  const note = figma.createFrame();
  note.name = "Annotation";
  note.layoutMode = "VERTICAL";
  note.paddingLeft = 12;
  note.paddingRight = 12;
  note.paddingTop = 8;
  note.paddingBottom = 8;
  note.itemSpacing = 0;
  note.fills = [{ type: "SOLID", color: { r: 1, g: 0.98, b: 0.9 } }];
  note.cornerRadius = 8;
  note.clipsContent = false;

  const text = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 14;
  text.characters = "";
  text.textAutoResize = "HEIGHT";
  note.appendChild(text);
  text.layoutSizingHorizontal = "FILL";
  text.layoutSizingVertical = "HUG";

  note.layoutSizingHorizontal = "FIXED";
  note.layoutSizingVertical = "HUG";

  note.resize(width, Math.max(note.height, 1));
  note.layoutSizingHorizontal = "FIXED";
  note.layoutSizingVertical = "HUG";

  const innerWidth = Math.max(note.width - note.paddingLeft - note.paddingRight, 0.01);
  text.resize(innerWidth, Math.max(text.height, 1));
  text.layoutSizingHorizontal = "FILL";
  text.layoutSizingVertical = "HUG";

  const layoutFrame = figma.createFrame();
  configureLayoutFrame(layoutFrame, side, note.width);

  const link = figma.createVector();
  link.name = "Annotation link";
  link.fills = [];
  link.strokes = [{ type: "SOLID", color: { r: 0.35, g: 0.35, b: 0.42 } }];
  link.strokeWeight = 2;

  let linkRow: FrameNode | null = null;
  if (side === "below" || side === "above") {
    linkRow = figma.createFrame();
    configureLinkRow(linkRow, note.width);
    linkRow.appendChild(link);
  }

  if (side === "below" || side === "right") {
    layoutFrame.appendChild(linkRow ?? link);
    layoutFrame.appendChild(note);
  } else {
    layoutFrame.appendChild(note);
    layoutFrame.appendChild(linkRow ?? link);
  }

  applyLayoutFrameChildrenSizing(link, note, side, linkRow);

  layoutFrame.layoutSizingVertical = "HUG";

  positionLayoutFrameRelativeToFrame(frame, layoutFrame, side);

  await setAnnotationLinkGeometry(link, layoutFrame, frame, note, side, linkRow);

  const rootGroup = figma.group([layoutFrame], parent);
  rootGroup.name = "Annotation";

  figma.viewport.scrollAndZoomIntoView([text]);
  focusEditorWindow();

  figma.currentPage.selection = [text];
  try {
    figma.currentPage.selectedTextRange = {
      node: text,
      start: 0,
      end: 0,
    };
  } catch {
    /* пустой текст — в редких сборках selectedTextRange может не примениться */
  }
}

function createFlow(): void {
  figma.notify("create-flow: добавьте здесь логику flow");
}

function openAnnotationSettings(): void {
  figma.showUI(__html__, { width: 320, height: 260, themeColors: true });

  void (async () => {
    const s = await getAnnotationSide();
    figma.ui.postMessage({ type: "init", side: s });
  })();

  figma.ui.onmessage = (msg: { type: string; side?: AnnotationSide }) => {
    if (msg.type === "save" && msg.side) {
      void figma.clientStorage.setAsync(STORAGE_KEY, msg.side).then(() => {
        figma.notify("Настройки сохранены");
        figma.closePlugin();
      });
    } else if (msg.type === "cancel") {
      figma.closePlugin();
    }
  };
}

async function main(): Promise<void> {
  const cmd = figma.command;
  let closePluginAfter = true;

  try {
    switch (cmd) {
      case "create-note":
        await createNote();
        break;
      case "annotation-settings":
        closePluginAfter = false;
        openAnnotationSettings();
        break;
      case "create-flow":
        createFlow();
        break;
      default:
        figma.notify(`Неизвестная команда: ${cmd}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    figma.notify(`Ошибка: ${message}`);
  } finally {
    if (closePluginAfter) {
      figma.closePlugin();
    }
  }
}

void main();
