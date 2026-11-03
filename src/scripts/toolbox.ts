// Live search and filters for the toolbox page. The list is rendered on the server, so it works without this.
export function initToolbox(root: Document = document) {
  const controls = root.querySelector<HTMLElement>('[data-toolbox-controls]');
  if (!controls) return;
  controls.hidden = false;

  const input = controls.querySelector<HTMLInputElement>('[data-q]')!;
  const catButtons = [...controls.querySelectorAll<HTMLButtonElement>('[data-cat]')];
  const tagButtons = [...controls.querySelectorAll<HTMLButtonElement>('[data-tag]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-tool]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-group]')];
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;

  let category = '';
  let tag = '';

  function apply() {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const li of items) {
      const ok =
        (!category || li.dataset.cat === category) &&
        (!tag || (li.dataset.tags ?? '').split('|').includes(tag)) &&
        (!q || (li.dataset.hay ?? '').includes(q));
      li.hidden = !ok;
      if (ok) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-tool]:not([hidden])');
    empty.hidden = shown > 0;
    count.textContent = shown === items.length ? `${items.length} things in the toolbox` : `Showing ${shown} of ${items.length}`;
  }

  input.addEventListener('input', apply);
  for (const b of catButtons) {
    b.addEventListener('click', () => {
      category = b.dataset.cat ?? '';
      for (const o of catButtons) o.setAttribute('aria-pressed', String(o === b));
      apply();
    });
  }
  for (const b of tagButtons) {
    b.addEventListener('click', () => {
      tag = tag === b.dataset.tag ? '' : (b.dataset.tag ?? '');
      for (const o of tagButtons) o.setAttribute('aria-pressed', String(o.dataset.tag === tag));
      apply();
    });
  }
  apply();
}
