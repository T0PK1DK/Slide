import { searchPlaces, type LonLat, type SearchHit } from "../lib/valhalla";

export function bindSearch(
  input: HTMLInputElement,
  box: HTMLElement,
  bias: () => LonLat | null,
  miami: LonLat,
  onPick: (hit: SearchHit) => void
) {
  let timer = 0;
  let items: SearchHit[] = [];
  let active = -1;
  const close = () => { box.hidden = true; active = -1; };
  const draw = () => renderSuggest(box, items, active, (hit) => { onPick(hit); close(); });

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        items = await searchPlaces(input.value, bias() ?? miami);
        active = -1;
        draw();
        box.hidden = items.length === 0;
      } catch {
        close();
      }
    }, 200);
  });

  input.addEventListener("keydown", (e) => {
    if (box.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = e.key === "ArrowDown"
        ? Math.min(active + 1, items.length - 1)
        : Math.max(active - 1, 0);
      draw();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      onPick(items[active]);
      close();
    } else if (e.key === "Escape") {
      close();
    }
  });
}

function renderSuggest(box: HTMLElement, items: SearchHit[], active: number, onPick: (hit: SearchHit) => void) {
  box.innerHTML = "";
  items.forEach((hit, i) => {
    const btn = document.createElement("button");
    btn.textContent = hit.label;
    btn.type = "button";
    if (i === active) { btn.classList.add("active"); btn.scrollIntoView({ block: "nearest" }); }
    btn.onclick = () => { onPick(hit); box.hidden = true; };
    box.appendChild(btn);
  });
}
