import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0E5C52",
          color: "#FAFAF8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 12h3l2-7 3 14 3-11 2 4h4"
                stroke="#D9A441"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>Voice Agent Builder</div>
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 600, lineHeight: 1.15, maxWidth: 900 }}>
          Describe the agent. It calls, qualifies, and books the meeting.
        </div>
        <div style={{ display: "flex", fontSize: 26, marginTop: 32, color: "#D9A441", maxWidth: 820 }}>
          An AI builder that designs a real voice AI assistant from a chat message.
        </div>
      </div>
    ),
    { ...size },
  );
}
