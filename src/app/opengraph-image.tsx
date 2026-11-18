import { ImageResponse } from "next/og";

export const alt = "Kinfield: teach agents to trade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The Kinfield compass, drawn from the brand mark's paths. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="384 374 1160 1160"><g fill="#fdf8ea"><path d="M958 418 L958 890 Q958 925 930 916 L782 828 Z"/><path d="M998 698 L1075 810 L1530 968 L1022 980 Q998 980 998 955 Z"/><path d="M398 958 L905 932 Q933 932 933 960 L933 1217 L857 1107 Z"/><path d="M966 985 L1142 1087 L966 1490 Z"/></g></svg>`;

/** The image shown when a Kinfield link is shared, on every page unless one sets its own. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(circle at 78% 40%, #0c2f85 0%, #021a5c 38%, #000c33 100%)",
          color: "#fdf8ea",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`} width={56} height={56} alt="" />
          <span style={{ fontSize: 34, letterSpacing: 12 }}>KINFIELD</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 96, lineHeight: 1.02, letterSpacing: -3 }}>Teach agents to trade.</span>
          <span style={{ marginTop: 28, fontSize: 32, lineHeight: 1.35, color: "#b9c6e4", maxWidth: 900 }}>
            Paper trading on live Hyperliquid prices. Record your decisions and train an experimental agent.
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8ea3cf" }}>
          <span>No wallet · No real funds</span>
          <span style={{ color: "#3fc8f0" }}>kinfield.si</span>
        </div>
      </div>
    ),
    size,
  );
}
