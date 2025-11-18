export default function ArbiAIDemo() {
  return (
    <div style={{ padding: 40, color: "white", background: "black", minHeight: "100vh" }}>
      <h1 style={{ color: "#3BFF8F", fontSize: 32, marginBottom: 20 }}>
        ArbiAI Prototype v2
      </h1>

      <p style={{ color: "#999", marginBottom: 40 }}>
        AI Operating System for Amazon Arbitrage
      </p>

      <div style={{ background: "#111", padding: 20, borderRadius: 12, marginBottom: 30 }}>
        <h2 style={{ color: "#167BF7" }}>AI Product Validator</h2>

        <input placeholder="Amazon URL" style={inputStyle} />
        <input placeholder="Supplier URL" style={inputStyle} />
        <input placeholder="Your Cost ($)" style={inputStyle} />
        <input placeholder="Pack Size" style={inputStyle} />

        <button style={buttonStyle}>Run AI Analysis</button>

        <div style={{ marginTop: 20, background: "#222", padding: 20, borderRadius: 8 }}>
          <p style={{ color: "#3BFF8F", fontSize: 20 }}>AI Result: BUY (89/100)</p>
          <p style={{ color: "#ccc" }}>ROI: 38% • Profit: $7.82 • Monthly Sales: 120</p>
          <p style={{ color: "#777" }}>Variation Risk: Low • Brand Risk: Very Low • Hazmat: No</p>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 8,
  border: "none",
  background: "#222",
  color: "white",
};

const buttonStyle = {
  width: "100%",
  padding: 14,
  marginTop: 16,
  background: "#3BFF8F",
  border: "none",
  color: "black",
  fontWeight: "bold",
  borderRadius: 12,
  cursor: "pointer",
};