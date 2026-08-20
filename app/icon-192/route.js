import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #241154 0%, #12092b 100%)",
        }}
      >
        <div style={{ fontSize: 96, display: "flex" }}>🕹️</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
