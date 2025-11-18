// app/page.tsx

export default function ArbiAIDashboard() {
  return (
    <div style={pageShell}>
      {/* Sidebar */}
      <aside style={sidebar}>
        <div style={sidebarHeader}>
          <div style={logoDot} />
          <div>
            <div style={logoText}>ArbiAI</div>
            <div style={logoSub}>AI OS for Arbitrage</div>
          </div>
        </div>

        <nav style={navSection}>
          <NavItem label="Dashboard" active />
          <NavItem label="Product Validator" />
          <NavItem label="Supplier Scanner" />
          <NavItem label="Replen Finder" />
          <NavItem label="Settings" />
        </nav>

        <div style={sidebarFooter}>
          <div style={{ fontSize: 12, color: "#777" }}>Today’s Time Saved</div>
          <div style={{ fontSize: 20, color: "#3BFF8F", fontWeight: 600 }}>
            3.4 hrs
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={main}>
        {/* Top bar */}
        <header style={topBar}>
          <div>
            <h1 style={topTitle}>Welcome back, KB 👋</h1>
            <p style={topSub}>
              Here’s what ArbiAI is seeing across your arbitrage business today.
            </p>
          </div>
          <button style={primaryButton}>+ New Scan</button>
        </header>

        {/* Stats row */}
        <section style={statsRow}>
          <StatCard
            label="Estimated Profit (30d)"
            value="$4,780"
            chip="+18% vs last month"
          />
          <StatCard
            label="Active Products"
            value="27"
            chip="9 new this week"
          />
          <StatCard
            label="Time Saved by AI"
            value="41 hrs"
            chip="13 manual tasks automated"
          />
        </section>

        {/* Main grid */}
        <section style={mainGrid}>
          {/* Left: Product Validator (your existing UI) */}
          <section style={panel}>
            <h2 style={panelTitle}>AI Product Validator</h2>
            <p style={panelSub}>
              Paste your Amazon + supplier data and let ArbiAI run the numbers.
            </p>

            <div style={inputGrid}>
              <input
                placeholder="Amazon URL"
                style={inputStyle}
              />
              <input
                placeholder="Supplier URL"
                style={inputStyle}
              />
              <input
                placeholder="Your Cost ($)"
                style={inputStyle}
              />
              <input
                placeholder="Pack Size"
                style={inputStyle}
              />
            </div>

            <button style={analyzeButton}>Run AI Analysis</button>

            <div style={resultBox}>
              <p style={{ color: "#3BFF8F", fontSize: 18, fontWeight: 600 }}>
                AI Result: BUY (89/100)
              </p>
              <p style={{ color: "#ccc" }}>
                ROI: 38% • Profit: $7.82 • Monthly Sales: 120
              </p>
              <p style={{ color: "#777", marginTop: 6 }}>
                Variation Risk: Low • Brand Risk: Very Low • Hazmat: No
              </p>
            </div>
          </section>

          {/* Right: Insights & Queue */}
          <section style={panel}>
            <h2 style={panelTitle}>AI Insights</h2>
            <p style={panelSub}>
              High-signal notes across suppliers, replens, and risk.
            </p>

            <ul style={insightsList}>
              <InsightItem
                title="Electrolyte powder margin spike"
                body="Supplier discount ending in 3 days. Reorder window ideal now
                for 23–30 units."
              />
              <InsightItem
                title="Baby wipes demand cooling 8%"
                body="Keep as replen but lower quantity to 15 units this cycle to
                protect cashflow."
              />
              <InsightItem
                title="2 SKUs flirting with IP risk"
                body="Brand enforcement activity rising. AI suggests switching to
                lower-risk alternatives."
              />
            </ul>

            <h3 style={{ ...panelTitle, marginTop: 24 }}>Today’s Queue</h3>
            <ul style={queueList}>
              <QueueItem label="Scan new Vitacost supplier list" eta="~6 min" />
              <QueueItem label="Re-check 9 low-velocity SKUs" eta="~4 min" />
              <QueueItem label="Generate 3 new replen ideas" eta="~3 min" />
            </ul>
          </section>
        </section>
      </main>
    </div>
  );
}

/* ---------- Small components ---------- */

function NavItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 14,
        cursor: "pointer",
        marginBottom: 6,
        background: active ? "#1b1b25" : "transparent",
        color: active ? "#ffffff" : "#aaaaaa",
        border: active ? "1px solid #3BFF8F33" : "1px solid transparent",
      }}
    >
      {label}
    </div>
  );
}

function StatCard({
  label,
  value,
  chip,
}: {
  label: string;
  value: string;
  chip: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, color: "#999" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{value}</div>
      <div style={statChip}>{chip}</div>
    </div>
  );
}

function InsightItem({ title, body }: { title: string; body: string }) {
  return (
    <li style={insightItem}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#aaa" }}>{body}</div>
    </li>
  );
}

function QueueItem({ label, eta }: { label: string; eta: string }) {
  return (
    <li style={queueItem}>
      <span>{label}</span>
      <span style={{ fontSize: 12, color: "#aaa" }}>{eta}</span>
    </li>
  );
}

/* ---------- Styles ---------- */

const pageShell: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  background: "#050509",
  color: "white",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const sidebar: React.CSSProperties = {
  width: 240,
  borderRight: "1px solid #1b1b25",
  padding: 18,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const sidebarHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const logoDot: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background:
    "radial-gradient(circle at 30% 30%, #3BFF8F, #167BF7 60%, #050509 100%)",
  boxShadow: "0 0 16px #3BFF8F66",
};

const logoText: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
};

const logoSub: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
};

const navSection: React.CSSProperties = {
  marginTop: 24,
};

const sidebarFooter: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "#0f1017",
  border: "1px solid #1b1b25",
};

const main: React.CSSProperties = {
  flex: 1,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 4,
};

const topTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
};

const topSub: React.CSSProperties = {
  fontSize: 13,
  color: "#aaa",
  marginTop: 4,
};

const primaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: "#3BFF8F",
  color: "#050509",
  fontWeight: 600,
  cursor: "pointer",
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const statCard: React.CSSProperties = {
  background: "#0c0d14",
  borderRadius: 14,
  padding: 14,
  border: "1px solid #1b1b25",
};

const statChip: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: "#3BFF8F",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#07140e",
  display: "inline-block",
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1.1fr)",
  gap: 18,
  marginTop: 8,
};

const panel: React.CSSProperties = {
  background: "#0c0d14",
  borderRadius: 16,
  padding: 18,
  border: "1px solid #1b1b25",
};

const panelTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
};

const panelSub: React.CSSProperties = {
  fontSize: 13,
  color: "#aaa",
  marginTop: 4,
  marginBottom: 16,
};

const inputGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #252637",
  background: "#131522",
  color: "white",
  fontSize: 13,
};

const analyzeButton: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 4,
  borderRadius: 10,
  border: "none",
  background: "#3BFF8F",
  color: "#050509",
  fontWeight: 600,
  cursor: "pointer",
};

const resultBox: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 12,
  background: "#111320",
  border: "1px solid #253143",
};

const insightsList: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const insightItem: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#10111c",
  border: "1px solid #1d1e2a",
};

const queueList: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  marginTop: 10,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const queueItem: React.CSSProperties = {
  fontSize: 13,
  padding: 8,
  borderRadius: 8,
  background: "#10111c",
  border: "1px dashed #262739",
  display: "flex",
  justifyContent: "space-between",
};