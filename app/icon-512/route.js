import { ImageResponse } from "next/og";

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
        <div style={{ fontSize: 256, display: "flex" }}>🕹️</div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
