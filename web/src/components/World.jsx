// =====================================================================
// World — ambient background.
// Four layers: aurora (drifting pigment), heat (bottom-up ember),
// ash (bone-colored drift specks), vig (deep vignette).
// =====================================================================
export default function World() {
  return (
    <div className="world" aria-hidden="true">
      <div className="aurora" />
      <div className="heat" />
      <div className="ash" />
      <div className="vig" />
    </div>
  );
}