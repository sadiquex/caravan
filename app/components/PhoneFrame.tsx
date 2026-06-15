"use client";

import { C } from "./GroupTrack";

// The phone-shaped shell. Full screen on mobile, a centered device frame on desktop.
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#08090C", minHeight: "100vh", position: "relative" }}>
      <div
        className="mx-auto md:my-8 relative overflow-hidden md:rounded-[36px]"
        style={{
          maxWidth: 420,
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div className="relative h-screen md:h-[820px]">{children}</div>
      </div>
    </div>
  );
}
