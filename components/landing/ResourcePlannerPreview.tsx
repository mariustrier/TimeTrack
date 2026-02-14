export function ResourcePlannerPreview({ monoClass }: { monoClass?: string }) {
  const mc = monoClass || "";

  // Helper for heat cells
  const Cell = ({ value, variant, today }: { value: number; variant: "ok" | "warn" | "over" | "low"; today?: boolean }) => (
    <div className={`lp-rp-cell${today ? " today-cell" : ""}`}>
      <div className="lp-heat-pill" style={{ background: `var(--lp-heat-${variant})` }}>
        <div className={`lp-heat-val ${mc}`} style={{ color: variant === "low" ? "var(--lp-dim)" : `var(--lp-heat-${variant}-t)` }}>{value}</div>
        <div className="lp-heat-unit" style={{ color: variant === "low" ? "var(--lp-dim)" : `var(--lp-heat-${variant}-t)` }}>timer</div>
      </div>
      {variant === "over" && <div className="lp-over-dot" />}
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="lp-toolbar">
        <div className="lp-toolbar-l">
          <span className="lp-toolbar-title">Ressourceplanlægger</span>
          <span className="lp-mode-badge"><span className="lp-mode-dot" />Oversigt</span>
          <span style={{ fontSize: 10, color: "var(--lp-muted)", fontWeight: 500 }}>7 teammedlemmer</span>
        </div>
        <div className="lp-toolbar-c">
          <button className="lp-t-btn">&#8249;</button>
          <button className="lp-t-btn">I dag</button>
          <button className="lp-t-btn">&#8250;</button>
          <span className={`lp-t-date ${mc}`}>6. jan — 24. mar</span>
        </div>
        <div className="lp-toolbar-r">
          <button className="lp-edit-btn">&#9744; Vælg</button>
        </div>
      </div>

      {/* Resource planner grid */}
      <div className="lp-rp-grid">
        <div className="lp-rp-left">
          <div className="lp-rp-left-hdr">
            <span style={{ fontSize: 8, fontWeight: 700, color: "var(--lp-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Teammedlemmer</span>
            <span style={{ fontSize: 8, color: "var(--lp-dim)" }}>259t/uge</span>
          </div>

          {/* Spacer matching team summary row */}
          <div style={{ height: 24, borderBottom: "1px solid var(--lp-border)", background: "var(--lp-bg)", display: "flex", alignItems: "center", padding: "0 14px" }}>
            <span style={{ fontSize: 7.5, fontWeight: 600, color: "var(--lp-muted)" }}>Teambelastning &#8594;</span>
          </div>

          {/* Employees */}
          {[
            { initials: "MS", name: "Marta S.", role: "Leder", roleBg: "#DBEAFE", roleColor: "#1E40AF", avatarBg: "rgba(30,64,175,.08)", avatarBorder: "rgba(30,64,175,.2)", avatarColor: "#1E40AF", util: 82, utilColor: "#059669", status: "OK", statusBg: "#D1FAE5", statusColor: "#059669" },
            { initials: "JL", name: "Jonas L.", role: "Senior", roleBg: "#E0E7FF", roleColor: "#3730A3", avatarBg: "rgba(55,48,163,.08)", avatarBorder: "rgba(55,48,163,.2)", avatarColor: "#3730A3", util: 103, utilColor: "#DC2626", status: "Overbooket", statusBg: "#FEE2E2", statusColor: "#DC2626", pulse: true },
            { initials: "AO", name: "Amara O.", role: "Senior", roleBg: "#E0E7FF", roleColor: "#3730A3", avatarBg: "rgba(55,48,163,.08)", avatarBorder: "rgba(55,48,163,.2)", avatarColor: "#3730A3", util: 78, utilColor: "#059669", status: "OK", statusBg: "#D1FAE5", statusColor: "#059669" },
            { initials: "ED", name: "Erik D.", role: "Mellem", roleBg: "#F3E8FF", roleColor: "#6B21A8", avatarBg: "rgba(107,33,168,.08)", avatarBorder: "rgba(107,33,168,.2)", avatarColor: "#6B21A8", util: 68, utilColor: "#D97706", status: "Delvis", statusBg: "#FEF3C7", statusColor: "#B45309", dotColor: "#D97706" },
            { initials: "SR", name: "Sofia R.", role: "Mellem", roleBg: "#F3E8FF", roleColor: "#6B21A8", avatarBg: "rgba(107,33,168,.08)", avatarBorder: "rgba(107,33,168,.2)", avatarColor: "#6B21A8", util: 80, utilColor: "#059669", status: "OK", statusBg: "#D1FAE5", statusColor: "#059669" },
          ].map((emp, i) => (
            <div key={i} className="lp-rp-emp">
              <div className="lp-rp-avatar" style={{ background: emp.avatarBg, border: `1.5px solid ${emp.avatarBorder}`, color: emp.avatarColor }}>{emp.initials}</div>
              <div className="lp-rp-emp-info">
                <div className="lp-rp-emp-name">
                  {emp.name}
                  <span className="lp-rp-role-badge" style={{ background: emp.roleBg, color: emp.roleColor }}>{emp.role}</span>
                </div>
                <div className="lp-rp-util-row">
                  <div className="lp-rp-util-track">
                    <div className="lp-rp-util-fill" style={{ width: `${Math.min(emp.util, 100)}%`, background: emp.utilColor }} />
                  </div>
                  <span className={`lp-rp-util-pct ${mc}`} style={{ color: emp.utilColor }}>{emp.util}%</span>
                  <span className="lp-rp-status" style={{ background: emp.statusBg, color: emp.statusColor }}>
                    <span className="lp-rp-status-dot" style={{ background: emp.dotColor || emp.statusColor, ...(emp.pulse ? { animation: "lp-pulse 1.5s ease infinite" } : {}) }} />
                    {emp.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Heatmap right */}
        <div className="lp-rp-right">
          <div className="lp-rp-weeks">
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
            ].map((w, i) => (
              <div key={i} className={`lp-rp-week-col${w.today ? " today-col" : ""}`}>
                <span className="lp-tl-wk-label" style={{ color: w.today ? "var(--lp-amber)" : "var(--lp-muted)" }}>{w.label}</span>
                <span className="lp-tl-wk-date" style={{ color: w.today ? "#92400E" : "var(--lp-dim)" }}>{w.date}</span>
              </div>
            ))}
          </div>

          {/* Team summary */}
          <div className="lp-rp-team-row">
            {[
              { pct: "81%", variant: "ok" },
              { pct: "84%", variant: "ok" },
              { pct: "89%", variant: "ok" },
              { pct: "92%", variant: "ok", today: true },
              { pct: "88%", variant: "ok" },
              { pct: "85%", variant: "ok" },
              { pct: "79%", variant: "warn" },
              { pct: "76%", variant: "warn" },
              { pct: "74%", variant: "warn" },
              { pct: "71%", variant: "warn" },
            ].map((t, i) => (
              <div key={i} className="lp-rp-team-cell" style={t.today ? { background: "rgba(245,158,11,.04)" } : {}}>
                <span className={`lp-team-pill ${mc}`} style={{ background: `var(--lp-heat-${t.variant})`, color: `var(--lp-heat-${t.variant}-t)` }}>{t.pct}</span>
              </div>
            ))}
          </div>

          {/* Marta — 82% */}
          <div className="lp-rp-heat-row">
            {[30,34,35,35,34,33,26,26,24,4].map((v,i) => {
              const variant = v < 10 ? "low" : v < 28 ? "warn" : "ok";
              return <Cell key={i} value={v} variant={variant as "ok"|"warn"|"over"|"low"} today={i===3} />;
            })}
          </div>

          {/* Jonas — overbooked */}
          <div className="lp-rp-heat-row">
            {[30,32,35,42,41,40,37,37,37,37].map((v,i) => {
              const variant = v > 37 ? "over" : "ok";
              return <Cell key={i} value={v} variant={variant as "ok"|"warn"|"over"|"low"} today={i===3} />;
            })}
          </div>

          {/* Amara — 78% */}
          <div className="lp-rp-heat-row">
            {[30,30,34,34,34,33,22,26,22,34].map((v,i) => {
              const variant = v < 28 ? "warn" : "ok";
              return <Cell key={i} value={v} variant={variant as "ok"|"warn"|"over"|"low"} today={i===3} />;
            })}
          </div>

          {/* Erik — 68% */}
          <div className="lp-rp-heat-row">
            {[30,30,34,37,37,37,15,19,22,26].map((v,i) => {
              const variant = v < 28 ? "warn" : "ok";
              return <Cell key={i} value={v} variant={variant as "ok"|"warn"|"over"|"low"} today={i===3} />;
            })}
          </div>

          {/* Sofia — 80% */}
          <div className="lp-rp-heat-row">
            {[30,30,33,34,34,33,30,30,28,28].map((v,i) => {
              const variant = v < 28 ? "warn" : "ok";
              return <Cell key={i} value={v} variant={variant as "ok"|"warn"|"over"|"low"} today={i===3} />;
            })}
          </div>
        </div>
      </div>
    </>
  );
}
