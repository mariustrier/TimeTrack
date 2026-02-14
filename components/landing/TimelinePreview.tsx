export function TimelinePreview({ monoClass }: { monoClass?: string }) {
  return (
    <>
      {/* Toolbar */}
      <div className="lp-toolbar">
        <div className="lp-toolbar-l">
          <span className="lp-toolbar-title">Projekttidslinje</span>
          <span className="lp-mode-badge">
            <span className="lp-mode-dot" />
            Oversigt
          </span>
        </div>
        <div className="lp-toolbar-c">
          <button className="lp-t-btn">‹</button>
          <button className="lp-t-btn">I dag</button>
          <button className="lp-t-btn">›</button>
          <span className={`lp-t-date ${monoClass || ""}`}>6. jan — 14. apr</span>
        </div>
        <div className="lp-toolbar-r">
          <div className="lp-scale-toggle">
            <button className="lp-scale-opt">Uge</button>
            <button className="lp-scale-opt active">Måned</button>
          </div>
          <button className="lp-edit-btn">✎ Redigér</button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="lp-timeline-grid">
        {/* Left: project list */}
        <div className="lp-tl-left">
          <div className="lp-tl-left-hdr">Projekter</div>

          {/* Project 1 — expanded */}
          <div className="lp-tl-row">
            <div className="lp-tl-row-top">
              <div className="lp-tl-dot" style={{ background: "#D97706" }} />
              <span className="lp-tl-name">Havnefronten</span>
              <span className="lp-tl-chevron" style={{ transform: "rotate(90deg)" }}>▸</span>
            </div>
            <div className="lp-tl-client">Meridian Properties</div>
            <div className="lp-tl-meta">
              <span className="lp-phase-badge" style={{ background: "#FCD34D" }}>Design Udvikling</span>
              <div className="lp-budget-track">
                <div className="lp-budget-fill" style={{ width: "72%", background: "#059669" }} />
              </div>
              <span className={`lp-budget-pct ${monoClass || ""}`} style={{ color: "#059669" }}>72%</span>
              <span className="lp-conflict-badge">2</span>
            </div>
          </div>

          {/* Project 2 — dimmed */}
          <div className="lp-tl-row dimmed">
            <div className="lp-tl-row-top">
              <div className="lp-tl-dot" style={{ background: "#2563EB" }} />
              <span className="lp-tl-name">Kulturhuset</span>
              <span className="lp-tl-chevron">▸</span>
            </div>
            <div className="lp-tl-client">Vestby Kommune</div>
            <div className="lp-tl-meta">
              <span className="lp-phase-badge" style={{ background: "#93C5FD" }}>Skitsering</span>
              <div className="lp-budget-track">
                <div className="lp-budget-fill" style={{ width: "45%", background: "#D97706" }} />
              </div>
              <span className={`lp-budget-pct ${monoClass || ""}`} style={{ color: "#D97706" }}>45%</span>
            </div>
          </div>

          {/* Project 3 — dimmed */}
          <div className="lp-tl-row dimmed">
            <div className="lp-tl-row-top">
              <div className="lp-tl-dot" style={{ background: "#059669" }} />
              <span className="lp-tl-name">Søbredden Kontor</span>
              <span className="lp-tl-chevron">▸</span>
            </div>
            <div className="lp-tl-client">Nordstjerne Udvikling</div>
            <div className="lp-tl-meta">
              <span className="lp-phase-badge" style={{ background: "#A7F3D0" }}>Forprojekt</span>
              <div className="lp-budget-track">
                <div className="lp-budget-fill" style={{ width: "88%", background: "#059669" }} />
              </div>
              <span className={`lp-budget-pct ${monoClass || ""}`} style={{ color: "#059669" }}>88%</span>
            </div>
          </div>

          {/* Project 4 — dimmed */}
          <div className="lp-tl-row dimmed">
            <div className="lp-tl-row-top">
              <div className="lp-tl-dot" style={{ background: "#9333EA" }} />
              <span className="lp-tl-name">Elmegade Rækkehuse</span>
              <span className="lp-tl-chevron">▸</span>
            </div>
            <div className="lp-tl-client">GreenBuild ApS</div>
            <div className="lp-tl-meta">
              <span className="lp-phase-badge" style={{ background: "#E9D5FF" }}>Forprojekt</span>
              <div className="lp-budget-track">
                <div className="lp-budget-fill" style={{ width: "61%", background: "#D97706" }} />
              </div>
              <span className={`lp-budget-pct ${monoClass || ""}`} style={{ color: "#D97706" }}>61%</span>
            </div>
          </div>
        </div>

        {/* Right: grid with bars */}
        <div className="lp-tl-grid">
          <div className="lp-today-line" />

          {/* Week headers — 12 columns */}
          <div className="lp-tl-weeks">
            {[
              { label: "U1", date: "6 jan" },
              { label: "U2", date: "13 jan" },
              { label: "U3", date: "20 jan" },
              { label: "I dag", date: "27 jan", today: true },
              { label: "U5", date: "3 feb" },
              { label: "U6", date: "10 feb" },
              { label: "U7", date: "17 feb" },
              { label: "U8", date: "24 feb" },
              { label: "U9", date: "3 mar" },
              { label: "U10", date: "10 mar" },
              { label: "U11", date: "17 mar" },
              { label: "U12", date: "24 mar" },
            ].map((w, i) => (
              <div key={i} className={`lp-tl-week-col${w.today ? " today-col" : ""}`}>
                <span className="lp-tl-wk-label" style={{ color: w.today ? "var(--lp-amber)" : "var(--lp-muted)" }}>{w.label}</span>
                <span className="lp-tl-wk-date" style={{ color: w.today ? "#92400E" : "var(--lp-dim)" }}>{w.date}</span>
              </div>
            ))}
          </div>

          {/* Row 1: Havnefronten — EXPANDED */}
          <div className="lp-tl-grid-row" style={{ height: "auto", minHeight: 62 }}>
            <div className="lp-proj-bar" style={{ left: "0%", width: "75%", background: "#D97706", opacity: 0.15, top: 20, transform: "none" }} />

            {/* Phase bands */}
            <div style={{ position: "relative", height: 28, marginTop: 4 }}>
              <div className="lp-phase-band" style={{ left: "0%", width: "20.8%", background: "#FDE68A" }} />
              <div className="lp-phase-band" style={{ left: "20.8%", width: "29.2%", background: "#FCD34D" }} />
              <div className="lp-phase-band" style={{ left: "50%", width: "25%", background: "#FBBF24" }} />
              <span style={{ position: "absolute", left: "1%", top: 6, fontSize: 7, fontWeight: 700, color: "#D97706", opacity: 0.65, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Skitsering</span>
              <span style={{ position: "absolute", left: "22%", top: 6, fontSize: 7, fontWeight: 700, color: "#D97706", opacity: 0.65, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Design Udvikling</span>
              <span style={{ position: "absolute", left: "51%", top: 6, fontSize: 7, fontWeight: 700, color: "#D97706", opacity: 0.65, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Konstr. Dok</span>
            </div>

            {/* Activity bars */}
            <div style={{ position: "relative" }}>
              {[
                { left: "0%", width: "10%", label: "Analyse" },
                { left: "4%", width: "14%", label: "Konceptskitser" },
                { left: "20.8%", width: "14%", label: "Plantegninger" },
                { left: "29%", width: "14%", label: "Facadestudier" },
                { left: "37.5%", width: "12.5%", label: "Materiale" },
                { left: "50%", width: "17%", label: "Tekniske tegninger" },
              ].map((a, i) => (
                <div key={i} style={{ height: 20, marginBottom: 2, position: "relative" as const }}>
                  <div className="lp-activity-bar" style={{ left: a.left, width: a.width, background: "#D97706CC" }}>
                    <span className="lp-activity-label">{a.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div className="lp-milestone-row">
              <div className="lp-milestone" style={{ left: "20.8%" }}>
                <span className="lp-ms-icon">◆</span>
                <span className="lp-ms-label">Skitsegodk.</span>
              </div>
              <div className="lp-milestone" style={{ left: "50%" }}>
                <span className="lp-ms-icon">▲</span>
                <span className="lp-ms-label">DD Aflevering</span>
              </div>
              <div className="lp-milestone" style={{ left: "75%" }}>
                <span className="lp-ms-icon">●</span>
                <span className="lp-ms-label">KD Færdig</span>
              </div>
            </div>
          </div>

          {/* Row 2: Kulturhuset — dimmed */}
          <div className="lp-tl-grid-row dimmed">
            <div className="lp-proj-bar" style={{ left: "8.3%", width: "83.3%", background: "#2563EB", opacity: 0.85 }} />
            <div className="lp-deadline" style={{ left: "calc(8.3% + 83.3% * 0.3)" }} />
          </div>

          {/* Row 3: Søbredden — dimmed */}
          <div className="lp-tl-grid-row dimmed">
            <div className="lp-proj-bar" style={{ left: "16.6%", width: "83.3%", background: "#059669", opacity: 0.85 }} />
            <div className="lp-deadline" style={{ left: "calc(16.6% + 83.3% * 0.3)" }} />
          </div>

          {/* Row 4: Elmegade — dimmed */}
          <div className="lp-tl-grid-row dimmed">
            <div className="lp-proj-bar" style={{ left: "25%", width: "58.3%", background: "#9333EA", opacity: 0.85 }} />
            <div className="lp-deadline" style={{ left: "calc(25% + 58.3% * 0.57)" }} />
          </div>
        </div>
      </div>
    </>
  );
}
