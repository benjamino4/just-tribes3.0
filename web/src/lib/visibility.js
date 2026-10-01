export function onVisible(el, onChange) {
  if (!el) return () => {};
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) onChange(e.isIntersecting);
  }, { threshold: 0.01 });
  io.observe(el);
  return () => io.disconnect();
}