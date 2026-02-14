import { RevealOnScroll } from "./RevealOnScroll";

export function InsightSection() {
  return (
    <RevealOnScroll className="lp-insight lp-reveal">
      <div className="lp-insight-label">Indsigt</div>
      <h2>
        Overblik ændrer beslutninger.<br />
        <em>Beslutninger ændrer omsætningen.</em>
      </h2>
      <p>
        Når tid, projekter og økonomi hænger sammen i ét system, kan du{" "}
        <strong>fakturere flere timer</strong>, holde styr på dækningsbidraget
        og gribe ind, før et projekt løber løbsk.
      </p>
    </RevealOnScroll>
  );
}
