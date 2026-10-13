
"use client";

const logos = [
  { src: "/ajdal.png", top: "8%", left: "4%", width: 140 },
  { src: "/dragoni.png", top: "15%", left: "76%", width: 150 },
  { src: "/home.png", top: "35%", left: "18%", width: 125 },
  { src: "/industries.png", top: "40%", left: "80%", width: 140 },
  { src: "/koza.png", top: "58%", left: "5%", width: 145 },
  { src: "/security.png", top: "67%", left: "68%", width: 130 },
  { src: "/services.png", top: "83%", left: "35%", width: 140 },
  { src: "/topaz.png", top: "86%", left: "84%", width: 115 },
];

export default function CompanyLogosBackground() {
  return (
    <div
      aria-hidden="true"
      className="company-logos-background"
    >
      {logos.map((logo, index) => (
        <img
          key={logo.src}
          src={logo.src}
          alt=""
          className="company-background-logo"
          style={{
            top: logo.top,
            left: logo.left,
            width: `min(${logo.width}px, 24vw)`,
            transform: `rotate(${index % 2 === 0 ? -8 : 8}deg)`,
          }}
        />
      ))}
    </div>
  );
}
